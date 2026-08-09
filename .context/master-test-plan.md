# Master Test Plan — Delivery Route Planner

```
+----------------------------------------------------------------------------+
|  MASTER TEST PLAN                                                           |
|  Qué probar en este sistema y por qué importa (roadmap de testing).        |
|  Derivado de business-data-map + business-feature-map (2026-08-09).         |
+----------------------------------------------------------------------------+
```

## 2. Executive risk map

Este sistema es pequeño pero tiene dos zonas donde un fallo "silencioso" lastima de verdad: la **optimización** (depende de OSRM/OR-Tools que pueden degradarse sin que el operador lo note, y el resultado reserva recursos del día) y el **ciclo de vida del plan** (transiciones irreversibles que se validan solo en el handler, no en la base). Una visita entregada por error, una parada resuelta dos veces o un plan cancelado cuando no debía no se revierten. El resto — CRUD de vehículos/visitas, importación Excel, histórico — es operativo y de confianza, con reglas PROTECT y validación por fila que merecen su lugar pero con menor riesgo de negocio.

| Priority | Flow | Por qué importa | Depende de / Afecta |
|---|---|---|---|
| CRITICAL | Crear optimización (Flujo 3, FEAT-005) | Es el núcleo del valor; degrada en silencio; el plan reserva recursos | Catálogo (F1/F2), OSRM, OR-Tools, disponibilidad (FEAT-004) |
| CRITICAL | Ejecutar plan: confirmar/resolver/completar (Flujo 4, FEAT-007/008) | Transiciones irreversibles; decisiones de negocio validan solo en el handler | Crear optimización (FEAT-005) |
| HIGH | Disponibilidad de recursos (FEAT-004) | Decide qué puede entrar al plan; inconsistencia = plan mal armado | Catálogo + reservas de planes |
| HIGH | Importación Excel (Flujo 2, FEAT-003) | Entrada externa masiva; tolerante a errores por diseño | Catálogo de visitas (FEAT-002) |
| MEDIUM | Gestión de flota y visitas (F1/F2, FEAT-001/002) | CRUD simple; riesgo de PROTECT en borrados | Optimización |

## 3. What to test first and why

### Crear optimización (CRITICAL)

- **Por qué importa**: es lo que el operador usa a diario. Si el plan sale mal armado (visita en el vehículo equivocado, hora fuera de ventana, parada sin asignar) se pierde el día de reparto; si el API cuelga, el operador no sabe si el plan se guardó.
- **Qué suele romperse**: doble `POST` a la misma fecha (reserva duplicada/fallo de ocupación), degradación de OSRM que cambia distancias sin avisar, mensajes 400 en español con ids inexistentes/ocupados, `unassigned_visits` que se informa pero no se persiste.
- **Dependencias**: catálogo (vehículos/visitas existentes), disponibilidad (recursos libres), OSRM/OR-Tools (optimización).
- **Qué revisaría un QA experimentado**:
  - El flujo feliz: 201 con rutas, paradas secuenciadas desde 1 y horas de llegada coherentes.
  - Reintento / doble envío: el segundo intento con los mismos recursos debe rechazarse por ocupación sin corromper el primero.
  - Fallo del optimizador externo: con OSRM caído, ¿sigue saliendo 201 con plan heurístico? ¿Nadie avisa al usuario de que perdió distancias reales?
  - Sin capacidad: cuando hay más carga que flota, `unassigned_visits` lista las correctas y la UI las advierte.
  - El umbral de nodos: por debajo y por encima de `ROUTING_OSRM_MAX_NODES=100`, ambos caminos de optimización se ejercen.

### Ejecutar plan: confirmar, resolver, completar (CRITICAL)

- **Por qué importa**: cada transición es terminal o desbloquea acciones irreversibles. Una parada "entregada" por error ya no se re-planifica; un plan cancelado no vuelve. El operador confía en que el estado que ve es el que va a persistir.
- **Qué suele romperse**: confirmar/completar/cancelar fuera de estado (400 correcto pero mensaje consistente), resolver una parada de otro plan (pertenencia), resolver dos veces la misma parada, timestamps (`confirmed_at`/`resolved_at`) que no se graban.
- **Dependencias**: plan creado (FEAT-005).
- **Qué revisaría un QA experimentado**:
  - Tabla completa de transiciones válidas e inválidas (pending/confirmed/completed/cancelled), cada una con su 400 en español.
  - Resolución de paradas: solo en confirmed, solo las del propio plan, solo pendientes; entregada vs fallida y su efecto en disponibilidad.
  - Liberación de recursos: cancelar/eliminar un plan hace que vehículo y visitas reaparezcan en `available/resources`.
  - Que la UI solo muestre los botones válidos para el estado (sin botones muertos que disparen 400).

### Disponibilidad de recursos (HIGH)

- **Por qué importa**: es el insumo de la optimización. Si dice "libre" lo que está reservado, el POST falla o el plan queda mal; si oculta lo que debería estar, el operador pierde capacidad útil del día.
- **Qué suele romperse**: la regla de reintento de visitas fallidas (solo desde el día siguiente), la visita entregada que reaparece, el vehículo de un plan cancelado que sigue ocupado.
- **Qué revisaría un QA experimentado**: matriz fecha×estado — vehículo/visita libres, reservados en pending, reservados en confirmed, liberados tras cancel, liberados tras delete, visitas entregadas/fallidas del mismo día y del día siguiente.

### Importación Excel (HIGH)

- **Por qué importa**: es la vía masiva de entrada de demanda; un error aquí puede cargar destinos con coordenadas inválidas que después "explotan" en la optimización.
- **Qué suele romperse**: extensión no permitida (400), archivo corrupto, filas con campos faltantes (deben ir a `errors`, no abortar), columnas duplicadas donde "gana la última", coordenadas fuera de rango.
- **Qué revisaría un QA experimentado**: lote mixto (válidas + inválidas) y conteo `created`/`errors`, fila con `name` vacío, lat/lng fuera de rango, archivo `.xlsx` real vs texto renombrado, y la semántica de columnas repetidas.

## 4. State machines that matter

### Optimization (pending → confirmed → completed / cancelled)

- **Por qué importan las transiciones**: confirmar "congela" el plan y habilita la resolución; completar cierra el día; cancelar es terminal. Una transición ilegal persistida no tiene vuelta atrás (completed/cancelled son irreversibles).
- **Transiciones más propensas a romperse**: `complete` desde un estado distinto de `confirmed`, `cancel` desde `completed/cancelled`, confirmar dos veces.
- **Estados a guardar**: `cancelled` y `completed` como terminales; la UI no debe ofrecer acciones en ellos.
- **Cómo se detectaría la corrupción**: hoy, solo por revisión manual del histórico o del `status` en la respuesta — no hay validación a nivel DB que impida un `status` ilegal si se escribe directo.

### RouteStop (pending → delivered | failed)

- **Por qué importan**: entrega vs fallo cambia la disponibilidad futura de la visita (entregada = nunca más; fallida = desde el día siguiente). Un "entregado" erróneo pierde la visita para siempre en la práctica.
- **Más propensas a romperse**: resolver paradas de otro plan, resolver dos veces (400 "La parada ya fue resuelta."), resolver con el plan sin confirmar.
- **Cómo se detectaría**: por el `resolved_at` y el estado en la UI; no hay auditoría histórica de quién/cuándo más allá del timestamp.

## 5. Silent killers — automated processes

Este sistema no tiene crons, webhooks ni triggers — todo el "procesamiento automático" ocurre dentro de la petición. Eso concentra los fallos silenciosos en tres puntos:

| Proceso | Qué depende de él | Qué pasa si falla / se duplica / cambia de orden | Cómo se detecta hoy | Estrategia QA |
|---|---|---|---|---|
| Degradación OSRM → heurística | Crear optimización (J1) | El plan se genera igual pero con distancias/tiempos no reales; **nadie lo sabe** | Ninguna (no hay log visible al usuario, no hay indicador en UI) | Probe sintético: OSRM caído → assert plan 201 + flag/heurística; revisar si la UI debería advertir |
| Reserva de recursos en `services.py` (busy/unavailable) | Disponibilidad + crear optimización | Inconsistencia entre disponibilidad y POST = 400 inesperado o doble reserva | Respuesta de `available/resources` vs `POST` | Test de consistencia: estado X del plan → disponibilidad exacta esperada |
| Reintento de visitas fallidas (día siguiente) | J1/J2 | Una fallida que reaparece el mismo día o nunca, rompe la planificación | Manual | Test de calendario: fallida hoy → no disponible hoy, sí mañana |

## 6. External integrations — failure points

| Servicio | Qué se detiene si cae | Timeouts/retries | Degradación aceptable | Quirks |
|---|---|---|---|---|
| OSRM | La matriz y geometría reales dentro de `POST /optimizations/` | Timeout 5s, sin retry | Sí — cae a heurística determinista (el servicio no se pierde) | Tests lo apagan (`conftest.py`); el branch real solo se ejerce manualmente; no hay SLAs |
| OR-Tools | El solver VRP | In-process | Sí — excepción → heurística | Límite de nodos (100) decide qué path se usa |
| OpenStreetMap tiles | Render del mapa (navegador) | n/a (frontend) | Cosmético — datos y plan intactos | Sin API key; puede estar bloqueado por red |
| openpyxl (Excel) | Importación de visitas | In-process | No — archivo ilegible = 400; filas malas no abortan el lote | Solo `.xlsx`/`.xlsm`; columnas duplicadas "gana la última" |

## 7. Dependency cascade between flows

```
Catálogo ──► Disponibilidad ──► Crear optimización ──► Ejecutar plan
 (F1/F2)      (FEAT-004)         (FEAT-005 + OSRM)      (FEAT-007/008)
    │              │                  │                     │
Import Excel ──────┘                  └──► Histórico (FEAT-009) ──► liberar recursos
(FEAT-003)
```

Cadena crítica nº 1: un error de disponibilidad se propaga a la optimización (paradas de más o de menos) y de ahí a la ejecución (paradas irreversibles). Probar `available/resources` aislado no basta — hay que probar `available → POST → confirm → deliver/complete` como cadena.

Cadena crítica nº 2: importación masiva → optimización. Coordenadas inválidas que pasan la importación (o columnas duplicadas) reventan recién en el plan del día. El QA debe cubrir la entrada con los ojos puestos en el destino, no solo en el 200 de la carga.

## 8. Edge cases developers commonly forget

- **Concurrencia**: dos `POST /optimizations/` simultáneos a la misma fecha con los mismos recursos (doble reserva); doble clic en Entregar/Fallar (idempotencia del 400).
- **Zona horaria / fecha**: el frontend toma "hoy" con `new Date().toISOString()` (UTC) — un operador en UTC-5 cerca de la medianoche obtiene el día equivocado como default.
- **Límites de datos**: umbral `ROUTING_OSRM_MAX_NODES=100` (101 nodos → heurística); `page_size` en listas; import de archivo enorme.
- **Estados huérfanos**: `unassigned_visits` no persistidas (demanda perdida que nadie re-procesa); planes cancelados que siguen en el histórico sin distintivo claro.
- **Idempotencia**: reintento de un `POST /optimizations/` tras timeout es ambiguo (¿se guardó o no?).
- **Ventana horaria**: solo `time` sin fecha y sin cruce de medianoche — una ventana 22:00–02:00 no se modela.
- **Permisos (ausencia)**: sin auth, cualquier cliente puede DELETE/CANCEL — probar el comportamiento con la suposición de que "no hay mal actor".

## 9. Pre-release checklist (priority-ordered)

1. Verify crear optimización devuelve 201 con rutas y paradas secuenciadas para una fecha válida.
2. Verify el segundo POST a la misma fecha con los mismos recursos se rechaza por ocupación sin corromper el primero.
3. Verify con OSRM caído (o `ROUTING_OSRM=0`) el plan se genera igual (201) por heurística.
4. Verify los 400 en español para ids inexistentes, vehículos ocupados y visitas no disponibles.
5. Verify la tabla completa de transiciones: confirm solo pending, complete solo confirmed, cancel solo pending/confirmed.
6. Verify deliver/fail solo en plan confirmed, parada pending y perteneciente al plan.
7. Verify cancelar/eliminar un plan libera vehículo y visitas en `available/resources` del mismo día.
8. Verify una visita fallida reaparece disponible al día siguiente y una entregada nunca.
9. Verify import con lote mixto devuelve `created` + `errors` correctos y rechaza extensión no permitida.
10. Verify DELETE de vehículo/visita con dependencias es rechazado (PROTECT).
11. Verify búsqueda y paginación en vehículos y visitas.
12. Verify el aviso de `unassigned_visits` cuando la carga supera la capacidad.
13. Verify el default de "hoy" en el selector de fecha es la fecha local del operador (no UTC).
14. Verify el umbral de nodos: por debajo y por encima de 100 se ejercen ambos paths de optimización.
15. Verify endpoints inexistentes responden 404 y payloads inválidos 400 sin efectos secundarios.

## 10. What is NOT in this plan

- Diagramas de flujo y tablas de transición de estados → `.context/business/business-data-map.md`
- Catálogo de features, matriz CRUD, feature flags → `.context/business/business-feature-map.md`
- Inventario de endpoints / contratos → `/business-api-map` (+ `bun run api:sync` cuando exista OpenAPI)
- Casos de prueba detallados y trazabilidad → TMS (ver `/test-documentation`)
- Orden de ejecución por sprint → reportes de `/sprint-testing`

## 11. Discovery gaps

- [ ] **OSRM sin cobertura con datos reales** — tests lo desactivan; el comportamiento real del path (respuesta del servicio, geometría, timeout) no está verificado ni hay indicador de degradación en UI.
- [ ] **Sin OpenAPI** — este plan se ancla en código y contextos; no hay spec para contratos formales ni `bun run api:sync`.
- [ ] **Sin autenticación** — no hay modelo de permisos que probar; el plan asume un solo operador benévolo.
- [ ] **Reglas de disponibilidad/reintento solo en código** — la semántica de "fallida → día siguiente" y "entregada → nunca" no está documentada como requerimiento formal ni cubierta por tests del SRS.
- [ ] **`unassigned_visits` no persistido** — sin forma de auditar demanda no asignada; no se puede probar como dato consultable.
- [ ] **Timestamp de auditoría mínimo** — solo `resolved_at`/`confirmed_at`/`completed_at`; sin historial de quién realizó cada transición (irrelevante hoy sin auth, relevante si se añade).
- [ ] **Django admin `/admin/`** sin personalizar — fuera del alcance de este plan hasta que se defina su rol.

---

**Resumen del reporte**: CRITICAL 2 · HIGH 2 · Silent killers 3 · Puntos de fallo de integración 4 · Discovery gaps abiertos 7.

# Business API Map — Delivery Route Planner

> Última verificación contra el código del target: 2026-08-09 · Sin OpenAPI publicado (ver §7 Discovery Gaps).
> Narrativa de negocio sobre el API. Catálogo exhaustivo → `/business-feature-map` §4; tipos TS → inexistentes hasta exponer OpenAPI.

## 1. Executive summary

El API permite a un operador logístico **tomar un día real de reparto y convertirlo en un plan persistente y ejecutable**: primero da de alta los recursos (vehículos) y la demanda (visitas), luego pregunta qué está disponible para la fecha elegida, y con esa selección genera un plan que asigna y secuencia cada entrega a un vehículo respetando capacidades, jornada y ventanas horarias. El mismo API acompaña al operador durante la ejecución del plan (confirmar, marcar entregas/fallos, completar) y le permite corregir o deshacer decisiones (cancelar, eliminar) sabiendo que cada acción libera los recursos reservados para ese día.

No hay sesión, login ni roles: cualquier cliente con acceso HTTP puede hacer todo. Esta ausencia de frontera es, a la vez, una ventaja operativa (cero fricción) y el principal riesgo de la plataforma (nada impide a un tercero cancelar un plan ajeno).

## 2. Permission & auth model

| Tier | A quién aplica | Cómo se obtiene | Dónde se aplica |
|---|---|---|---|
| **Public** (único) | Cualquier cliente HTTP | Sin credenciales | N/A — no hay middleware/auth ni decoradores de permiso; DRF default `AllowAny` |

```
Operador/curl ──(HTTP /api/*, sin token)──▶ Django/DRF (AllowAny) ──▶ ViewSet ──▶ Service/ORM
```

No existe flujo de login/token/refresh (no hay `django.contrib.auth` en la ruta API, no hay JWT/session). El único esquema "autenticado" es el Django admin (`/admin/`), fuera del alcance del API y sin usuarios personalizados. Todas las decisiones de autorización son en realidad **reglas de negocio dentro de los handlers** (estado válido para cada transición), no permisos.

## 3. Critical business journeys

### J1 — Preparar y optimizar el reparto del día

*Propósito*: partir de la flota y la demanda registradas y obtener, en una sesión, el plan de rutas para una fecha.

```
Client                              Backend (DRF)                    DB / OSRM
  │  POST /api/vehicles/ (xN)          │                                │
  │  POST /api/visits/    (xN)         │── create/validators ──▶        │
  │  GET /api/available/resources/?date=D                              │
  │────────────────────────────────────▶── available_vehicles/visits ─▶│
  │  POST /api/optimizations/ {ids,date}                               │
  │────────────────────────────────────▶── validar ids/ocupación/──────▶│
  │                                     │   disponibilidad (400 es)     │
  │                                     │── optimize_all ─────────────▶│ OSRM matriz
  │                                     │   (OR-Tools/heurística)       │ + geometría
  │                                     │── persist_optimization ─────▶│ Optimization+Routes+Stops
  │◀─ 201 {optimization, unassigned_visits}                             │
```

1. El operador registra los vehículos y visitas del día (creación unitaria; las visitas también pueden llegar por lote, ver J3).
2. Pregunta al API qué está libre para la fecha: la respuesta filtra vehículos ya reservados y visitas no re-planificables — el frontend preselecciona todo y permite deseleccionar.
3. `POST /optimizations/` re-verifica en el servidor que los ids existan y que nada esté ocupado (mensajes 400 en español), porque el recurso pudo reservarse entre la consulta y la creación.
4. El backend optimiza (matriz OSRM + OR-Tools, o heurística si falla/supera 100 nodos), persiste el plan completo y devuelve además las visitas que **no** cupieron por capacidad para que el operador las gestione aparte.
5. El cliente dibuja el plan sobre el mapa; si hubo no-asignadas, muestra advertencia.

- **Endpoints**: `POST /api/vehicles/` · `POST /api/visits/` · `GET /api/available/resources/` · `POST /api/optimizations/`
- **Entities**: Vehicle, Visit, Optimization, OptimizationRoute, RouteStop
- **Features**: FEAT-001, FEAT-002, FEAT-004, FEAT-005, FEAT-006

### J2 — Ejecutar el plan: confirmar, resolver paradas, completar

*Propósito*: transitar el plan de "borrador" a "ejecutado", registrando el resultado de cada entrega.

```
Client                               Backend                        DB
  │ POST /{id}/confirm/                 │── pending→confirmed ─────▶│ confirmed_at
  │ POST /{id}/stops/{stop}/deliver/ (xN)                            │
  │────────────────────────────────────▶── validar confirmed+owner+ ─▶│ stop.resolved_at
  │ POST /{id}/stops/{stop}/fail/ (xN)    pending (400 en español)    │  →delivered/failed
  │ POST /{id}/complete/                 │── confirmed→completed ───▶│ completed_at
```

1. Confirmar solo es válido desde `pending`; fija `confirmed_at` y "desbloquea" la resolución de paradas.
2. Cada parada se marca entregada o fallida; el API valida que el plan esté confirmado, que la parada pertenezca al plan y que siga pendiente (400 "La parada ya fue resuelta."). Entregada queda no re-planificable; fallida libera la visita para el día siguiente.
3. Completar solo es válido desde `confirmed`; cierra el plan con `completed_at`.

- **Endpoints**: `POST /api/optimizations/{id}/confirm/` · `/complete/` · `/cancel/` · `/stops/{stop_id}/deliver/` · `/fail/`
- **Entities**: Optimization (state machine), RouteStop (state machine), Visit (disponibilidad)
- **Features**: FEAT-007, FEAT-008

### J3 — Cargar destinos en lote desde Excel

*Propósito*: incorporar decenas de visitas de una sola vez con validación tolerante a errores.

```
Client                              Backend (visits/import)        DB
  │ POST /api/visits/import/ (file)                                  │
  │────────────────────────────────────▶── validar extensión/leer ──▶│
  │                                     │   openpyxl                  │
  │                                     │── import_visits_from_workbook ─▶│ (fila válida → insert)
  │◀─ 200 {created: N, errors: [...]}                                  │
```

1. El archivo `.xlsx`/`.xlsm` debe tener `name, latitude, longitude`; el resto de columnas son opcionales.
2. El servidor valida extensión y legibilidad (400 con mensaje en español si falla), pero a nivel de fila es tolerante: las válidas se insertan y las inválidas se reportan sin abortar el lote.

- **Endpoints**: `POST /api/visits/import/`
- **Entities**: Visit
- **Features**: FEAT-003

### J4 — Corregir el plan y liberar recursos

*Propósito*: deshacer una planificación (plan mal armado, día cambiado) sin dejar "basura" que bloquee vehículos y visitas.

```
Client                               Backend                       DB
  │ GET /api/optimizations/             │── list (prefetch routes) ─▶│
  │ POST /{id}/cancel/  (pending|confirmed) ──▶ cancelled ─────────▶│ (libera recursos)
  │ DELETE /{id}/       (cualquier estado) ──▶ cascade ────────────▶│ (libera recursos)
```

1. El operador revisa el histórico; cada plan muestra resumen y detalle expandible.
2. Cancelar deja el plan en estado terminal (visible en el histórico); eliminar lo borra en cascada. Ambos liberan los vehículos y visitas del día (verificable: el día siguiente vuelven a `available/resources`).

- **Endpoints**: `GET /api/optimizations/` · `POST /api/optimizations/{id}/cancel/` · `DELETE /api/optimizations/{id}/`
- **Entities**: Optimization, OptimizationRoute, RouteStop, Vehicle/Visit (liberación)
- **Features**: FEAT-009, FEAT-007

## 4. Architecture behind the API

```
 Browser (SPA React/Vite)                    Python (Django 5.2 + DRF)
 ┌────────────────────────┐      /api        ┌──────────────────────────────────┐
 │ RouteOptimizer / lists │──proxy Vite────▶│ ViewSets (vehicles, visits,      │
 │ fetch nativo (api.ts)  │                  │  routing)                        │
 └────────────────────────┘                  │   └─ services.py                 │
                                             │      ├─ validate_* / available_* │
                                             │      ├─ optimize_all (OR-Tools)  │
                                             │      └─ persist_optimization     │
                                             │   └─ osrm.py (HTTP) ─────────────▶ OSRM
                                             │   └─ ORM ────────────────────────▶ SQLite
                                             └──────────────────────────────────┘
```

| Component | Rol | Persistencia / integraciones | Por qué importa para QA |
|---|---|---|---|
| `VehicleViewSet` / `VisitViewSet` | CRUD + búsqueda + import | SQLite; openpyxl (import) | PROTECT en borrados; búsqueda server-side |
| `OptimizationViewSet` | Crear plan + acciones de estado + resolver paradas | SQLite (cascade); OSRM/OR-Tools en `create` | Reglas de negocio viven en el handler, no en la DB |
| `AvailableViewSet` | Disponibilidad del día | SQLite (consulta de reservas) | Falla si la lógica de reserva no es consistente con create |
| `routing/services.py` | Optimización y persistencia | OR-Tools; OSRM (HTTP); SQLite | Degradación silenciosa = riesgo silencioso |
| `osrm.py` | Cliente HTTP de matriz/geometría | OSRM externo (timeout 5s) | No probado con datos reales en tests |

Forma de despliegue: **monolito local** (sin gateway, sin workers, sin colas, sin cache). Todo el procesamiento es síncrono dentro de la petición HTTP — un colgado de OSRM se absorbe por timeout/degradación y el plan se genera igual.

## 5. External integrations

| Servicio | Disparador | Dirección | Modo de fallo (visible al usuario) | Journeys afectados |
|---|---|---|---|---|
| OSRM (`router.project-osrm.org`) | `POST /api/optimizations/` | Outbound síncrono | Timeout 5s → degrada a heurística: plan se genera igual, pero distancias/tiempos y geometría dejan de ser de calles reales | J1 |
| OR-Tools | En proceso (`optimize_all`) | In-process | Excepción → degrade a heurística (mismo efecto) | J1 |
| OpenStreetMap tiles | Render de `MapContainer` en el navegador | Outbound (navegador) | Mapa en blanco/sin tiles; el plan y los datos no dependen de ello | J1 (visual) |
| openpyxl | `POST /api/visits/import/` | In-process | Archivo ilegible → 400; filas inválidas → reportadas, no abortan | J3 |

No hay webhooks inbound/outbound, ni colas, ni SDKs de pago/email/auth en el boundary del API.

## 6. Cross-references

- **Data-map entities expuestos**: Vehicle, Visit, Optimization, OptimizationRoute, RouteStop → `.context/business/business-data-map.md#mapa-de-entidades`
- **Features que este API respalda**: FEAT-001…FEAT-009 → `.context/business/business-feature-map.md#2-feature-catalog-por-dominio`
- **Spec OpenAPI**: no publicada (el target no expone schema; `drf-spectacular` no instalado). Única fuente actual: código (urls/views/serializers).
- **`api/schemas/`**: inexistente — `bun run api:sync` no tiene de dónde leer hasta exponer OpenAPI.

## 7. Discovery gaps

- [ ] **Sin OpenAPI** — no hay spec para `bun run api:sync`; el mapa se construyó por escaneo de urls/views. Staleness solo detectable re-escaneando código.
- [ ] **Sin auth ni roles** — tier único Public; "authorization" es solo reglas de negocio en handlers. No hay login, token ni refresh que probar; el riesgo de seguridad es un gap de producto.
- [ ] **J1 no idempotente** — un doble `POST /optimizations/` para la misma fecha/recursos crea dos planes y reserva dos veces (el segundo falla por ocupación, pero un reintento tras error parcial es ambigüo).
- [ ] **`unassigned_visits` solo en la respuesta del POST** — no es recuperable después; no hay endpoint de "plan + no asignadas".
- [ ] **OSRM sin cobertura con datos reales** — los tests lo desactivan (`conftest.py`); el branch `ROUTING_OSRM=True` solo se ejerce manualmente.
- [ ] **`OptimizationRoute.geometry` sin consumidor** — el API lo sirve pero el cliente dibuja rectas; integración en desuso.
- [ ] **Paginación del histórico ignorada por el cliente** — `GET /optimizations/` pagina pero la UI solo muestra `results` (página 1).
- [ ] **Django admin `/admin/`** expuesto por defecto fuera del modelo de permisos de la app.

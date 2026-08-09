# Non-Functional Specs — Delivery Route Planner

> Discovery (reverse-engineering). Generated: 2026-08-08.

## NFR Index

| NFR | Category | Priority | Source |
|-----|----------|----------|--------|
| NFR-001 | Rendimiento — determinismo de optimización | P0 | PRD executive-summary |
| NFR-002 | Rendimiento — latencia de optimización | P0 | PRD executive-summary |
| NFR-003 | Rendimiento — paginación | P0 | `config/pagination.py` |
| NFR-004 | Confiabilidad — fallback OSRM | P0 | `routing/services.py` |
| NFR-005 | Seguridad — autenticación/autorización | P1 | `config/settings.py:69-72` |
| NFR-006 | Seguridad — secretos y configuración | P1 | `config/settings.py:24-29` |
| NFR-007 | Seguridad — CORS | P1 | `config/settings.py:59` |
| NFR-008 | Mantenibilidad — N+1 | P0 | `routing/views.py:16` |
| NFR-009 | Mantenibilidad — consistencia de datos (FK/protección) | P0 | models PROTECT/CASCADE |
| NFR-010 | Escalabilidad — límites de entrada | P2 | PRD (300 visitas / 10 vehículos) |
| NFR-011 | Observabilidad — logs y telemetría | P2 | settings (ausente) |

---

## NFR-001: Determinismo de optimización

| Aspect | Value |
|--------|-------|
| Feature | Misma entrada → misma salida (heurística) |
| Metric | Salida idéntica ante misma `(fecha, vehicle_ids, visit_ids, seed de datos)` |
| Priority | P0 |
| Source | PRD executive-summary (KPIs inferidos — sin telemetría real) |

### Requirement

La optimización heurística (`_optimize_heuristic`) y la resolución VRP (OR-Tools) deben producir resultados **reproducibles** para una misma entrada y estado de datos.

### Acceptance Criteria

- [ ] Dos llamadas idénticas de `optimize_all` devuelven rutas, secuencias, métricas y `unassigned_visits` idénticos.
- [ ] Sin dependencia de orden de iteración no determinista (set/list) en `services.py`.
- [ ] Semilla fija si OR-Tools usara aleatoriedad (hoy no la usa en el flujo verificado).

### Risk / Notes

- OSRM introduce variación por estado de la red (matriz de tiempos); con OSRM activo el determinismo está sujeto al servicio externo. El fallback heurístico sí es determinista.

---

## NFR-002: Latencia de optimización

| Aspect | Value |
|--------|-------|
| Feature | Tiempo de respuesta de `POST /api/optimizations/` |
| Metric | ≤ 2 s para 300 visitas / 10 vehículos (objetivo de PRD) |
| Priority | P0 |
| Source | PRD executive-summary |

### Requirement

La creación de una optimización (validación + planificación + persistencia) debe completarse en tiempo aceptable para el volumen objetivo.

### Acceptance Criteria

- [ ] 300 visitas / 10 vehículos: creación < 2 s (con fallback heurístico).
- [ ] Timeout OSRM configurado (5 s, `ROUTING_OSRM_TIMEOUT`) no bloquea el flujo: fallback disparado.
- [ ] N+1 mitigado con `prefetch_related` (NFR-008) en listado.

### Risk / Notes

- OSRM: red local o servicio con latencia alta; el timeout 5 s protege pero degrada el peor caso a ~5 s antes del fallback.
- Sin benchmark ejecutado aún (gap).

---

## NFR-003: Paginación

| Aspect | Value |
|--------|-------|
| Feature | Respuestas de listado paginadas |
| Metric | `page_size` 10 por defecto; máx 100; `?page_size=` permitido |
| Priority | P0 |
| Source | `backend/config/pagination.py:1-8` |

### Requirement

Todo listado (`vehicles`, `visits`, `optimizations`) devuelve resultados paginados con límite duro.

### Acceptance Criteria

- [ ] `GET /api/vehicles/` → `Paginated` (count, next, previous, results).
- [ ] `page_size` > 100 → capado a 100.
- [ ] Paginación consistente entre endpoints (misma configuración global).

---

## NFR-004: Confiabilidad — fallback OSRM

| Aspect | Value |
|--------|-------|
| Feature | Disponibilidad de optimización ante fallo externo |
| Metric | Optimización nunca falla por indisponibilidad de OSRM |
| Priority | P0 |
| Source | `routing/services.py:206-260` (`_optimize_vrp` → `_optimize_heuristic`) |

### Requirement

Si la matriz OSRM no puede construirse (red caída, timeout, nodos > 100), el sistema debe caer a la heurística y devolver un resultado válido en vez de 500.

### Acceptance Criteria

- [ ] `ROUTING_OSRM=1` con OSRM no disponible → respuesta 201 (heurística), sin excepción propagada.
- [ ] `ROUTING_OSRM=0` → siempre heurística.
- [ ] Nodos > `ROUTING_OSRM_MAX_NODES` (100) → heurística.
- [ ] Métricas de la ruta coherentes aunque no provengan de OSRM (gap: no verificado).

### Risk / Notes

- El fallback está envuelto en try/except; no hay test dedicado de la transición OSRM→heurística (ver gap).

---

## NFR-005: Seguridad — autenticación/autorización

| Aspect | Value |
|--------|-------|
| Feature | Control de acceso |
| Metric | Sin endpoints protegidos |
| Priority | P1 |
| Source | `config/settings.py:69-72` (`DEFAULT_AUTHENTICATION_CLASSES: []`, `DEFAULT_PERMISSION_CLASSES: [AllowAny]`) |

### Requirement

Todo endpoint es anónimo (`AllowAny`). Es un diseño explícito del prototipo (sin usuarios ni roles) y se documenta como riesgo.

### Acceptance Criteria

- [ ] Documentado en este doc y en `risk-assessment.md`.
- [ ] No añadir auth sin decisión de producto.

### Risk / Notes

- Riesgo HIGH/MEDIUM ya registrado en risk-assessment (acceso total a datos y acciones).

---

## NFR-006: Seguridad — secretos y configuración

| Aspect | Value |
|--------|-------|
| Feature | Secretos y configuración de entorno |
| Metric | `SECRET_KEY` hardcodeada; `DEBUG=True`; `ALLOWED_HOSTS=['*']` |
| Priority | P1 |
| Source | `config/settings.py:24,27,29` |

### Requirement

Configuración segura para ambientes distintos de dev.

### Acceptance Criteria

- [ ] `SECRET_KEY` desde variable de entorno (o vault) en cualquier ambiente no-dev.
- [ ] `DEBUG=False` en producción.
- [ ] `ALLOWED_HOSTS` restringido.
- [ ] Los 3 items registrados en risk-assessment (ya HIGH).

---

## NFR-007: Seguridad — CORS

| Aspect | Value |
|--------|-------|
| Feature | Política CORS |
| Metric | `CORS_ALLOW_ALL_ORIGINS=True` |
| Priority | P1 |
| Source | `config/settings.py:59` |

### Requirement

CORS abierto a cualquier origen (apropiado solo para dev).

### Acceptance Criteria

- [ ] Restringir orígenes permitidos en no-dev.
- [ ] Registrado en risk-assessment.

---

## NFR-008: Mantenibilidad — evitar N+1

| Aspect | Value |
|--------|-------|
| Feature | Consultas eficientes en listados |
| Metric | Sin queries N+1 en endpoints de listado |
| Priority | P0 |
| Source | `routing/views.py:16` (`prefetch_related("routes__stops__visit", "routes__vehicle")`) |

### Requirement

Los endpoints que serializan relaciones anidadas (optimizaciones) deben prefetchear.

### Acceptance Criteria

- [ ] `GET /api/optimizations/` hace un número fijo de queries (no 1 + N).
- [ ] Extender patrón a nuevos endpoints anidados.

---

## NFR-009: Mantenibilidad — consistencia de datos

| Aspect | Value |
|--------|-------|
| Feature | Integridad referencial |
| Metric | FK con PROTECT en bordes de negocio; CASCADE en agregados |
| Priority | P0 |
| Source | `routing/models.py`, `vehicles/models.py`, `visits/models.py` |

### Requirement

- `OptimizationRoute.optimization` → CASCADE (borrar optimización borra rutas).
- `RouteStop.route` → CASCADE (borrar ruta borra paradas).
- `OptimizationRoute.vehicle` → PROTECT (no borrar vehículo con rutas).
- `RouteStop.visit` → PROTECT (no borrar visita con paradas).

### Acceptance Criteria

- [ ] Borrar optimización elimina rutas y paradas y **libera recursos** (BR-004/005; verificado 2026-08-08).
- [ ] Borrar vehículo con rutas → bloqueado (mensaje/status por confirmar, gap).

---

## NFR-010: Escalabilidad — límites de entrada

| Aspect | Value |
|--------|-------|
| Feature | Límites de volumen |
| Metric | Objetivo PRD: 300 visitas / 10 vehículos |
| Priority | P2 |
| Source | PRD executive-summary |

### Requirement

El sistema debe manejar el volumen objetivo sin degradación estructural (paginación, índices).

### Acceptance Criteria

- [ ] 300 visitas / 10 vehículos operan con la UX esperada (listado paginado, optimización < 2 s).
- [ ] Import Excel de hasta ~300 filas sin timeout.

### Risk / Notes

- SQLite (single-file) es limitante para concurrencia; aceptable para el alcance (gap: sin prueba de concurrencia).

---

## NFR-011: Observabilidad

| Aspect | Value |
|--------|-------|
| Feature | Logs, tracing y métricas |
| Metric | Ausente (sin logging configurado, sin telemetría) |
| Priority | P2 |
| Source | settings (nada) |

### Requirement

(Recomendación) Registrar errores, duración de optimización y fallos de OSRM para soportar NFR-001/002/004.

### Acceptance Criteria

- [ ] (Gap) Sin implementación; registrado como deuda.
- [ ] Al menos logging de excepciones en `optimize_all` fallback.

---

## Summary Table

| NFR | Categoría | Métrica / Umbral | Estado | Ref |
|-----|-----------|------------------|--------|-----|
| NFR-001 | Performance | Salida idéntica | Cumple (heurística); gap OSRM | services.py |
| NFR-002 | Performance | < 2 s / 300 visitas | No medido (gap) | — |
| NFR-003 | Performance | page_size 10 / max 100 | Cumple | pagination.py |
| NFR-004 | Reliability | Fallback siempre | Cumple (try/except); gap test dedicado | services.py |
| NFR-005 | Security | — | No cumple (AllowAny) — riesgo documentado | settings.py |
| NFR-006 | Security | — | No cumple (secret/DEBUG/hosts) — riesgo | settings.py |
| NFR-007 | Security | — | No cumple (CORS abierto) — riesgo | settings.py |
| NFR-008 | Maintainability | Sin N+1 | Cumple (prefetch) | views.py |
| NFR-009 | Maintainability | FK consistency | Cumple (PROTECT/CASCADE) | models |
| NFR-010 | Scalability | 300/10 | No probado (gap) | PRD |
| NFR-011 | Observability | — | No cumple (deuda) | settings |

## Discovery Gaps

- [ ] Sin benchmark de latencia para 300 visitas / 10 vehículos (NFR-002 no medido).
- [ ] Transición OSRM→heurística sin test dedicado (NFR-004).
- [ ] `prefetch_related` sin contador de queries en test (NFR-008).
- [ ] SQLite: concurrencia de escrituras no probada (NFR-010).
- [ ] Sin logging/telemetría; no hay forma de observar fallos de OSRM en producción (NFR-011).
- [ ] Mensaje/status del PROTECT al borrar vehículo/visita con dependencias no confirmado (NFR-009).

## QA Relevance

- Cobertura ≥ 85% (backend) y ≥ 80% (frontend) exigida por gates; NFRs no cubiertos por tests unitarios hoy (gap de performance/security).
- Tests de fallback: forzar `ROUTING_OSRM=1` con OSRM inaccesible → expect 201 heurística.
- Tests de paginación: `page_size` > 100 capado.
- Tests de seguridad/consistencia: DELETE protegido por PROTECT y CASCADE + liberación de recursos (BR-004/005).

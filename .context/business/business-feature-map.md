# Business Feature Map — Delivery Route Planner

> Descubrimiento (reverse-engineering). Generado: 2026-08-09 · Fuentes: `../route-optimizer/backend` (urls/views/serializers/settings), `../route-optimizer/frontend` (App.tsx, components, api.ts), `.context/business/business-data-map.md`, `.context/SRS/*`, `.context/infrastructure/*`, git history.

## 1. Inventory summary

| Categoría | Features | Estado |
|---|---|---|
| Core | 4 | Stable |
| Secundario | 4 | Stable |
| Beta | 0 | — |
| Planned | 1 | Incompleto (update de vehículos/visitas sin UI) |

Total: **9 features** (todas Stable salvo el update UI, que existe solo a nivel API).

## 2. Feature catalog (por dominio)

### Dominio: Vehículos (flota)

#### Feature: Gestión de vehículos

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-001 |
| **Status** | Stable |
| **Endpoints** | `GET/POST/PUT/PATCH/DELETE /api/vehicles/` |
| **UI** | `VehicleForm`, `VehicleList`, `Pagination`, tab "Vehículos" |
| **Users** | Operador logístico (único rol, sin auth) |
| **Dependencies** | — |
| **Evidence** | `vehicles/views.py:7-11`, `frontend/src/components/VehicleForm.tsx`, `App.tsx:85-97` |

**Capabilities:**
- [x] Crear vehículo (nombre, capacidad dual kg/litros, velocidad media, depósito lat/lng, jornada, almuerzo)
- [x] Listar con búsqueda por nombre (`?search=`) y paginación (`?page=&page_size=`)
- [x] Eliminar vehículo (protegido si ya tiene rutas — PROTECT)
- [ ] Editar vehículo en la UI (el API expone PUT/PATCH pero no hay formulario de edición)

### Dominio: Visitas (destinos)

#### Feature: Gestión de visitas

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-002 |
| **Status** | Stable |
| **Endpoints** | `GET/POST/PUT/PATCH/DELETE /api/visits/` |
| **UI** | `VisitForm`, `VisitList`, `Pagination`, tab "Visitas" |
| **Users** | Operador logístico |
| **Dependencies** | — |
| **Evidence** | `visits/views.py:26-31`, `frontend/src/components/VisitForm.tsx` |

**Capabilities:**
- [x] Crear visita (coordenadas, tiempo de servicio, prioridad, peso/volumen, ventana horaria opcional)
- [x] Listar con búsqueda por nombre y paginación
- [x] Eliminar visita (protegido si ya fue programada — PROTECT)
- [ ] Editar visita en la UI (mismo caso que FEAT-001)

#### Feature: Importación masiva de visitas

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-003 |
| **Status** | Stable |
| **Endpoints** | `POST /api/visits/import/` |
| **UI** | `VisitImport` (selector de archivo) |
| **Users** | Operador logístico |
| **Dependencies** | openpyxl |
| **Evidence** | `visits/views.py:32-59`, `visits/services.py` (`import_visits_from_workbook`), `frontend/src/components/VisitImport.tsx` |

**Capabilities:**
- [x] Subir `.xlsx`/`.xlsm` con columnas `name, latitude, longitude` (requeridas) + opcionales
- [x] Validación por fila con reporte `{created, errors}` sin abortar las filas válidas
- [x] Rechazo de extensión no permitida (400 "El archivo debe ser un .xlsx")
- [ ] Definir el contrato de columnas a nivel UI (el formulario no muestra las columnas esperadas al usuario)

### Dominio: Optimización (planificación)

#### Feature: Consulta de recursos disponibles

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-004 |
| **Status** | Stable |
| **Endpoints** | `GET /api/available/resources/?date=YYYY-MM-DD` |
| **UI** | `RouteOptimizer` (checkbox de selección, preselección total) |
| **Users** | Operador logístico |
| **Dependencies** | — |
| **Evidence** | `routing/views.py:138-167`, `routing/services.py` (`available_vehicles`, `available_visits`), `frontend/src/components/RouteOptimizer.tsx:59-73` |

**Capabilities:**
- [x] Vehículos libres del día (sin optimización pending/confirmed que los reserve)
- [x] Visitas disponibles del día (no entregadas, no reservadas hoy, fallidas no reintentables hoy)
- [x] Validación de fecha obligatoria y formato (400 en español)

#### Feature: Crear optimización (optimizar + persistir)

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-005 |
| **Status** | Stable |
| **Endpoints** | `POST /api/optimizations/` |
| **UI** | `RouteOptimizer` (botón "Optimizar", selección por checkboxes) |
| **Users** | Operador logístico |
| **Dependencies** | OSRM, OR-Tools, heurística fallback |
| **Evidence** | `routing/views.py:20-65`, `routing/services.py` (`optimize_all`, `persist_optimization`), `frontend/src/components/RouteOptimizer.tsx:85-102` |

**Capabilities:**
- [x] Validar ids existentes, ocupación de vehículos y disponibilidad de visitas (400 en español)
- [x] Optimizar con VRP (OR-Tools + matriz OSRM si `ROUTING_OSRM=1` y ≤ 100 nodos; si no, heurística determinista)
- [x] Persistir `Optimization` + `OptimizationRoute`s + `RouteStop`s (sequence ordenada)
- [x] Devolver `unassigned_visits` (visitas que no cupieron por capacidad) — advertencia en UI
- [ ] Persistir `unassigned_visits` (solo viaja en la respuesta, no se guarda)

#### Feature: Visualización de rutas en mapa

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-006 |
| **Status** | Stable |
| **Endpoints** | (consume la respuesta de `POST/GET /api/optimizations/`) |
| **UI** | `RouteOptimizer` (MapContainer Leaflet) |
| **Users** | Operador logístico |
| **Dependencies** | react-leaflet, OpenStreetMap tiles, `utils/geo.ts` |
| **Evidence** | `frontend/src/components/RouteOptimizer.tsx:245-276` (polylines por ruta, markers depósito/parada, FitBounds) |

**Capabilities:**
- [x] Polilínea por ruta con color distinto y marcadores con popups
- [x] Encuadre automático (FitBounds) al área de la ruta
- [x] Formato de distancia (km) y duración (hh:mm) en las route cards
- [ ] Respetar la geometría OSRM si existe (`route.geometry` disponible en el modelo pero el mapa dibuja línea recta depósito→paradas)

### Dominio: Ciclo de vida del plan

#### Feature: Transiciones de estado (confirmar/completar/cancelar)

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-007 |
| **Status** | Stable |
| **Endpoints** | `POST /api/optimizations/{id}/confirm/`, `/complete/`, `/cancel/` |
| **UI** | `RouteOptimizer` (botones contextuales), `OptimizationList` (Cancelar) |
| **Users** | Operador logístico |
| **Dependencies** | — |
| **Evidence** | `routing/views.py:67-103`, `frontend/src/components/RouteOptimizer.tsx:191-207` |

**Capabilities:**
- [x] Confirmar (solo pending, set `confirmed_at`)
- [x] Completar (solo confirmed, set `completed_at`)
- [x] Cancelar (solo pending|confirmed, estado terminal)
- [x] Reglas de negocio con 400 en español y timestamps en cada transición

#### Feature: Resolución de paradas (entregar/fallar)

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-008 |
| **Status** | Stable |
| **Endpoints** | `POST /api/optimizations/{id}/stops/{stop_id}/deliver/`, `/fail/` |
| **UI** | `RouteOptimizer` (botones Entregar/Fallar por parada, solo en confirmed) |
| **Users** | Operador logístico |
| **Dependencies** | — |
| **Evidence** | `routing/views.py:105-135`, `frontend/src/components/RouteOptimizer.tsx:223-238` |

**Capabilities:**
- [x] Entregar parada (solo optimización confirmed + parada pending, set `resolved_at`)
- [x] Fallar parada (misma regla; libera la visita para re-planificación desde el día siguiente)
- [x] 400 si la parada no existe en el plan o ya fue resuelta

#### Feature: Histórico y gestión de optimizaciones

| Aspecto | Valor |
|---|---|
| **ID** | FEAT-009 |
| **Status** | Stable |
| **Endpoints** | `GET /api/optimizations/`, `DELETE /api/optimizations/{id}/` |
| **UI** | `OptimizationList` (acordeón por plan, Cancelar/Eliminar) |
| **Users** | Operador logístico |
| **Dependencies** | — |
| **Evidence** | `routing/views.py:15-18`, `frontend/src/components/OptimizationList.tsx` |

**Capabilities:**
- [x] Listar planes con resumen (fecha, estado, nº rutas, nº paradas, fecha creación)
- [x] Expandir para ver rutas (vehículo, distancia, duración, inicio/fin) y paradas con estado
- [x] Cancelar (si pending|confirmed) y eliminar (cualquier estado; cascade libera recursos)
- [ ] Paginación del histórico (la UI ignora la paginación de la API)

## 3. CRUD matrix

| Entidad | Create | Read | Update | Delete | Evidencia |
|---|---|---|---|---|---|
| Vehicle | ✅ | ✅ | ⚠️ API sin UI | ⚠️ PROTECT con rutas | `vehicles/` |
| Visit | ✅ | ✅ | ⚠️ API sin UI | ⚠️ PROTECT programada | `visits/` |
| Optimization | ✅ | ✅ | ⚠️ vía actions (confirm/complete/cancel) | ✅ (cascade) | `routing/optimizations/` |
| OptimizationRoute | — | ✅ (anidada) | ❌ | ❌ (con el plan) | `OptimizationSerializer` |
| RouteStop | — | ✅ (anidada) | ⚠️ vía deliver/fail | ❌ (con el plan) | `OptimizationSerializer` |

Leyenda: ✅ Full · ⚠️ Parcial/condicional · ❌ No disponible

## 4. API endpoint inventory

Auth: **todos públicos** (AllowAny, sin autenticación). Agrupado por dominio.

| Method | Endpoint | Propósito | Auth |
|---|---|---|---|
| **Vehículos** | | | |
| GET | `/api/vehicles/` | Listar + búsqueda `?search=name` + paginación | — |
| POST | `/api/vehicles/` | Crear vehículo | — |
| GET | `/api/vehicles/{id}/` | Detalle | — |
| PUT/PATCH | `/api/vehicles/{id}/` | Editar (sin UI) | — |
| DELETE | `/api/vehicles/{id}/` | Eliminar (PROTECT si rutas) | — |
| **Visitas** | | | |
| GET | `/api/visits/` | Listar + búsqueda + paginación | — |
| POST | `/api/visits/` | Crear visita | — |
| GET | `/api/visits/{id}/` | Detalle | — |
| PUT/PATCH | `/api/visits/{id}/` | Editar (sin UI) | — |
| DELETE | `/api/visits/{id}/` | Eliminar (PROTECT si programada) | — |
| POST | `/api/visits/import/` | Importación masiva Excel (`file` multipart) | — |
| **Optimizaciones** | | | |
| GET | `/api/optimizations/` | Listar (prefetch routes/stops/visit/vehicle) | — |
| POST | `/api/optimizations/` | Crear: validar + optimizar + persistir | — |
| GET | `/api/optimizations/{id}/` | Detalle | — |
| DELETE | `/api/optimizations/{id}/` | Eliminar (cascade) | — |
| POST | `/api/optimizations/{id}/confirm/` | pending → confirmed | — |
| POST | `/api/optimizations/{id}/complete/` | confirmed → completed | — |
| POST | `/api/optimizations/{id}/cancel/` | pending|confirmed → cancelled | — |
| POST | `/api/optimizations/{id}/stops/{stop_id}/deliver/` | Resolver parada: entregada | — |
| POST | `/api/optimizations/{id}/stops/{stop_id}/fail/` | Resolver parada: fallida | — |
| **Disponibilidad** | | | |
| GET | `/api/available/resources/?date=` | Vehículos y visitas disponibles del día | — |
| **Admin (Django)** | | | |
| GET | `/admin/` | Django admin por defecto | — |

## 5. UI component inventory

### Forms

| Componente | Feature | Acción del usuario | Endpoints que llama |
|---|---|---|---|
| `VehicleForm` | FEAT-001 | Alta de vehículo | `POST /vehicles/` |
| `VisitForm` | FEAT-002 | Alta de visita | `POST /visits/` |
| `VisitImport` | FEAT-003 | Subir Excel de visitas | `POST /visits/import/` |

### Dashboards/Views

| Componente | Feature | Qué muestra/permite |
|---|---|---|
| `VehicleList` | FEAT-001 | Tabla paginada con búsqueda y borrado |
| `VisitList` | FEAT-002 | Tabla paginada con búsqueda y borrado |
| `RouteOptimizer` | FEAT-004..008 | Selector de día, checkboxes de recursos, botón Optimizar, route cards + mapa Leaflet, acciones de ciclo de vida y paradas |
| `OptimizationList` | FEAT-009 | Histórico en acordeón con cancelar/eliminar |
| `Pagination` | FEAT-001/002 | Paginación de listas |

### Actions (botones/confirmaciones)

| Acción | Feature | Condición de visibilidad |
|---|---|---|
| Confirmar / Completar / Cancelar | FEAT-007 | Según estado (pending → Confirmar; confirmed → Completar/Cancelar) |
| Entregar / Fallar (por parada) | FEAT-008 | Optimización confirmed y parada pending |
| Cancelar / Eliminar (histórico) | FEAT-009 | Cancelar si pending|confirmed; Eliminar siempre |
| Eliminar vehículo/visita | FEAT-001/002 | Siempre (API puede rechazar por PROTECT) |

Roles: **un solo rol** (operador logístico); sin login, sin menús condicionados por rol.

## 6. Third-party integrations

| Servicio | Propósito | Paquete | Estado | Features |
|---|---|---|---|---|
| OSRM (router.project-osrm.org) | Matriz de calles (dist/tiempo) + geometría de ruta | `requests` | Activo (default `ROUTING_OSRM=1`), timeout 5s, degrade a heurística | FEAT-005 |
| OR-Tools | Solver VRP (capacidad dual, jornada/almuerzo, ventanas) | `ortools` | Activo (tras matriz OSRM; degrade a heurística) | FEAT-005 |
| OpenStreetMap | Tiles del mapa | `leaflet` + `react-leaflet` | Activo (sin API key) | FEAT-006 |
| Excel (.xlsx/.xlsm) | Ingesta masiva de visitas | `openpyxl` | Activo | FEAT-003 |
| Django admin | (por defecto, sin personalizar) | `django` | Activo | — |

No hay: auth, email, pagos, storage/upload, monitoreo, analytics, webhooks.

## 7. Feature flags y WIP

| Flag | Descripción | Default | Entorno |
|---|---|---|---|
| `ROUTING_OSRM` | Activa el path OSRM + OR-Tools (matriz real de calles) | `1` (activado) | `settings.py:61`; tests lo fuerzan a `False` (`conftest.py:6`) |
| `ROUTING_OSRM_URL` | Endpoint del router | `https://router.project-osrm.org` | `settings.py:62` |
| `ROUTING_OSRM_TIMEOUT` | Timeout por petición OSRM | `5` s | `settings.py:63` |
| `ROUTING_OSRM_MAX_NODES` | Límite de nodos para usar OSRM (por encima → heurística) | `100` | `settings.py:64` |

| Feature planeada/incompleta | Evidencia | Estado estimado |
|---|---|---|
| Edición de vehículos/visitas en UI | API expone PUT/PATCH, `VehicleForm`/`VisitForm` solo crean | Parcial — API lista, UI pendiente |
| Persistencia de `unassigned_visits` | Solo en la respuesta del POST | Gap de diseño |
| Geometría OSRM en el mapa | `geometry` en el modelo; UI dibuja rectas | Gap de implementación |

Sin `TODO`/`FIXME`/`WIP`/`HACK` en el código y sin `FEATURE_`/`ENABLE_`/`BETA_` en el frontend.

## 8. QA relevance

### Feature test coverage matrix

| Feature ID | Unit | Integration | E2E | Estado |
|---|---|---|---|---|
| FEAT-001 Vehículos | ✅ | ✅ | ⚠️ | Cubierto (API + unit; E2E parcial) |
| FEAT-002 Visitas | ✅ | ✅ | ⚠️ | Cubierto |
| FEAT-003 Import Excel | ✅ | ✅ | ⚠️ | Cubierto (errores parciales: sin test de columnas duplicadas) |
| FEAT-004 Recursos disponibles | ✅ | ✅ | ❌ | Cubierto |
| FEAT-005 Crear optimización | ✅ | ✅ | ⚠️ | Cubierto (OSRM con mock; no datos reales) |
| FEAT-006 Mapa | ⚠️ | ❌ | ⚠️ | Parcial (react-leaflet mockeado en unit) |
| FEAT-007 Transiciones | ✅ | ✅ | ⚠️ | Cubierto (state transitions en pytest) |
| FEAT-008 Resolución paradas | ✅ | ✅ | ❌ | Cubierto |
| FEAT-009 Histórico | ✅ | ✅ | ⚠️ | Cubierto |

*(Backend: 7 archivos pytest, coverage 89% gate ≥85%. Frontend: 10 archivos vitest, 91.86% líneas gate ≥80%. E2E: 1 spec Playwright desde agentic-qa-simpliroute.)*

### High-risk features (priorizar testing)

| Feature | Riesgo | Razón |
|---|---|---|
| FEAT-005 Crear optimización | HIGH | Núcleo del valor; integra OSRM + OR-Tools con degradación silenciosa; resultado no idempotente (reserva recursos) |
| FEAT-007/008 Transiciones de estado | HIGH | Reglas de negocio viven solo en código (no en DB); cada transición es unilateral y terminal |
| FEAT-003 Import Excel | MEDIUM | Entrada externa; validación por fila con semántica de "última columna gana" no fijada |
| FEAT-006 Mapa | MEDIUM | Cobertura unitaria con leaflet mockeado; render real solo en E2E manual |
| Toda la API | HIGH | Sin autenticación (AllowAny): cualquier cliente puede crear/borrar/cancelar planes |

## 9. Discovery gaps

- [ ] **Sin auth** — toda la API es pública; no hay roles que mapear ni permisos. Riesgo operativo real (cualquiera puede DELETE).
- [ ] **Update sin UI** — PUT/PATCH de vehículos y visitas expuestos pero sin formulario; feature "editar" incompleta de facto.
- [ ] **OSRM sin validar con datos reales** — los tests lo desactivan (`conftest.py`); el path real solo se ejerce en manual.
- [ ] **`unassigned_visits` efímero** — se informa en el POST pero no se persiste; no consultable después.
- [ ] **Geometría de ruta sin usar** — `OptimizationRoute.geometry` existe; la UI dibuja rectas depósito→paradas.
- [ ] **Histórico sin paginación en UI** — `OptimizationList` consume solo `results` (página 1, 10 por defecto).
- [ ] **Django admin `/admin/`** expuesto por defecto, sin restricción ni branding.
- [ ] **Import Excel con columnas duplicadas** — gana la última; semántica no documentada ni testeada.
- [ ] **Sin OpenAPI publicado** — contrato no consumible para `bun run api:sync` (se cubre con `/business-api-map`).
- [ ] **Calidad del código target** — sin lint/format/pre-commit en backend ni frontend (registrado en assessment Phase 1).

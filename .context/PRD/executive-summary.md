# Executive Summary — Delivery Route Planner

> Discovery (reverse-engineering), no aspirational design. Generated: 2026-08-08 · Re-baselined: 2026-08-08 (feature "Optimizaciones" añadida al target).

## 1. Problem Statement

Las empresas de última milla deben asignar N destinos a una flota de vehículos, cada uno con capacidad (kg y litros), jornada laboral y punto de partida (depósito). Sin optimización, el orden de visita es arbitrario y se desperdician horas de conducción — "Un repartidor tiene N destinos y un vehículo con una capacidad. ¿En qué orden visitarlos y qué destinos atender para minimizar el tiempo total?" (Source: `README.md` l1-6).

Las alternativas actuales son: planificación manual (orden arbitrario) u optimizadores comerciales con costos de licencia/matrices de distancia de pago. Este proyecto resuelve el problema con una **heurística determinista propia** (misma entrada → misma salida), distancia por **haversine** y mapa gratuito de **OpenStreetMap sin API key** — cero costo de integraciones (Source: `SRS/architecture.md` §System Overview; `README.md` l12, l14-19).

La plataforma **persiste** el resultado con un ciclo de vida (pending→confirmed→completed/cancelled; stops delivered/failed), lo que convierte la planificación en un documento ejecutable del día, no en una consulta descartable (Source: `README.md` l14-18; `business/business-data-map.md` §Máquinas de estado).

## 2. Solution Overview

### Product Vision (one sentence)

Plataforma web estilo SimpliRoute que permite a un operador logístico definir su flota y destinos, importar lotes desde Excel y obtener rutas del día optimizadas, persistidas y dibujadas sobre un mapa.

### Core Capabilities

| # | Feature | Problem Addressed | Evidence (route or component) |
|---|---------|-------------------|-------------------------------|
| 1 | CRUD de vehículos (capacidad dual, jornada, almuerzo, depósito) | Definir flota con restricciones reales | `frontend/src/components/VehicleForm.tsx`; `GET/POST /api/vehicles/` (backend `vehicles/`) |
| 2 | CRUD de visitas + import masivo Excel | Cargar destinos individualmente o en lote sin abortar filas inválidas | `frontend/src/components/VisitForm.tsx`, `VisitImport.tsx`; `POST /api/visits/import/` (backend `visits/`) |
| 3 | Optimización determinista por fecha (capacidad dual + vecino más cercano + ventanas horarias) | Minimizar distancia y tiempo respetando restricciones | `frontend/src/components/RouteOptimizer.tsx`; `POST /api/optimizations/`; `backend/routing/services.py` `optimize_all` |
| 4 | Persistencia y ciclo de vida de la planificación (confirmar/completar/cancelar; entregar/fallar paradas) | Convertir la ruta en documento ejecutable del día | `frontend/src/components/RouteOptimizer.tsx:191-207,223-238`; endpoints `confirm/complete/cancel`, `stops/{id}/deliver|fail` |
| 5 | Gestión de optimizaciones (listado, expandir rutas/paradas, cancelar, eliminar) | Visibilidad y control de planificaciones existentes; liberar recursos reservados | `frontend/src/components/OptimizationList.tsx`; `GET/DELETE /api/optimizations/{id}/` (añadido en re-baseline 2026-08-08) |

### Key Differentiators

- **Heurística determinista** intercambiable por OR-Tools tras la interfaz `routing.services.optimize_all` sin tocar el contrato (Source: `SRS/architecture.md` §System Overview).
- **Mapa gratis** (Leaflet/OSM, sin API key) y **distancia haversine** — sin matrices de Google ni datos de tráfico (Source: `SRS/architecture.md` §System Overview; `README.md` l12).
- **Capacidad dual simultánea** (kg Y litros): una visita entra solo si no excede ninguna de las dos (Source: `backend/routing/services.py` `_fits_capacity`; BR-1 en domain-glossary).

## 3. Success Metrics

### Tracked Metrics

| Metric | Type | Implementation | Source |
|--------|------|----------------|--------|
| (ninguna) | — | No hay analytics/track/event en `frontend/src`; sin Sentry/Datadog/PostHog en `package.json` | grep `frontend/src` + `frontend/package.json` |

### Inferred KPIs (from features, not real tracking)

| KPI | Rationale | Evidence |
|-----|-----------|----------|
| Tiempo de optimización < 2 s para 300 visitas | Umbral definido como métrica de calidad en tests de rendimiento | `backend/routing/test_performance.py` (@pytest.mark.slow); `SRS/non-functional-specs.md` NFR-002 (latencia) |
| Cobertura ≥ 85% backend / ≥ 80% frontend | Definición de calidad del proyecto | Gates en `backend/pytest.ini` y `frontend/vitest.config.ts`; `SRS/non-functional-specs.md` §NFR Index |
| Visitass asignadas vs no asignadas por día | Proxies la calidad del plan (capacidad cubierta) | `CreateOptimizationResult.unassigned_visits` en `frontend/src/types.ts`; warning en `RouteOptimizer.tsx:282-288` |

### Unknown Metrics (gaps)

- Volumen real de rutas/días por cliente: sin telemetría ni entornos desplegados.
- Costo operativo ahorrado (km reales vs plan): no hay datos de ejecución agregados.

## 4. Target Users

| Persona | System Role | Need | Evidence |
|---------|-------------|------|----------|
| Operador logístico (planificador) | Crea vehículos/visitas, importa Excel, genera la ruta del día | Autopista de entrada de datos + optimización | `frontend/src/components/VehicleForm.tsx`, `VisitForm.tsx`, `VisitImport.tsx`, `RouteOptimizer.tsx`; `PRD/user-personas.md` |
| Supervisor de operaciones (ejecutor) | Confirma/completa/cancela planificaciones, resuelve paradas, monitorea optimizaciones | Control del ciclo de vida y visibilidad de planes | `RouteOptimizer.tsx:191-238`; `OptimizationList.tsx` (re-baseline 2026-08-08) |

> Detalle completo: `.context/PRD/user-personas.md`. Sin auth en la API (`AllowAny`) — ambos perfiles usan la misma instancia sin login (Source: `backend/config/settings.py`).

## 5. Product Scope

### What's Included (current capabilities)

- CRUD vehículos y visitas con validaciones de dominio (capacidades ≥ 0, lat/lon ranges, velocidad ≥ 0.1, service time/priority ≥ 1) (Source: BR-7 en domain-glossary; `backend/vehicles/models.py`, `backend/visits/models.py`).
- Import masivo Excel con reporte parcial `{created, errors[]}` (Source: `README.md` l85-86).
- Optimización por fecha: selección por prioridad dentro de capacidad dual, orden por vecino más cercano desde depósito, respeto de ventanas horarias y jornada/almuerzo (Source: `business/business-data-map.md` §Optimización; `SRS/functional-specs.md` FR-004).
- Persistencia con ciclo de vida y disponibilidad (vehículos/visitas ocupados no se re-ofrecen) (Source: `business/business-data-map.md` §Máquinas de estado).
- Gestión de optimizaciones: listado, detalle expandible, cancelar, eliminar (Source: `OptimizationList.tsx`, re-baseline 2026-08-08).

### What's Not Included (known limitations)

- Sin auth ni multi-tenant: `DEFAULT_PERMISSION_CLASSES = AllowAny`, sin autenticación (Source: `backend/config/settings.py`).
- Sin optimización óptima (OR-Tools): heurística determinista actual (Source: `SRS/architecture.md` §External Services).
- Sin replanificación parcial del mismo día (Source: `SRS/functional-specs.md` Discovery Gaps).
- Import solo `.xlsx/.xlsm`, no `.csv` (Source: `business/business-data-map.md` §Discovery Gaps).
- Sin entornos desplegados (qa/staging/prod): solo local dev (Source: `.context/project-config.md` §Environments).

### Future Indicators

- OR-Tools como dependencia ya listada en `backend/requirements.txt` (`ortools==9.15.*`) pero no usada en runtime (Source: `backend/requirements.txt`).
- `SRS/architecture.md` §External Services: OR-Tools disponible como path alternativo.
- `business/business-data-map.md` Discovery Gaps: import `.csv`, validar columnas duplicadas.

## 6. Discovery Gaps

| Gap | Impact | Suggested Source |
|-----|--------|------------------|
| Sin telemetría/analytics | No hay métricas reales de adopción/engagement | Confirmar con dueño del producto si se requiere trackear |
| Sin issue tracker / stories | Fase 4 backlog mapping bloqueada por diseño | route-optimizer es proyecto de ejemplo sin Jira/Notion |
| Revenue model desconocido | No hay señales de monetización | Confirmar con dueño del producto |
| Sin env desplegados | No hay datos de usuarios reales ni escala | Confirmar si existe una instancia desplegada |
| Formato exacto de `geometry` | Campo JSON en `OptimizationRoute` documentado como `[lat, lon]`; estructura no confirmada con datos reales | `.context/business/domain-glossary.md` §8 Discovery Gaps |

## 7. QA Relevance

### Critical Testing Areas

- Algoritmo de optimización: determinismo (misma entrada → misma salida), capacidad dual, prioridad, ventanas horarias/jornada/almuerzo (BR-1..BR-5).
- Ciclo de vida de `Optimization` y `RouteStop`: state-transition por endpoint (`confirm/complete/cancel`, `deliver/fail`).
- Disponibilidad: vehículos/visitas reservados no se re-ofrecen; `DELETE` de optimización libera recursos (verificado en vivo en re-baseline 2026-08-08).
- Import Excel: filas inválidas reportadas sin abortar; defaults por celda vacía.
- Mapa Leaflet: render/markers/polylines — mockear `react-leaflet` en unit tests (Source: `.context/business/business-model.md` §4).

### Risk Areas

- Sin auth (AllowAny): API abierta — aceptable para proyecto de ejemplo (Source: `risk-assessment.md` #9).
- `geometry` sin contrato confirmado: riesgo para tests de polilínea.
- Cobertura frontend 91.86% (gate 80%) y backend 89% (gate 85%) están por encima del umbral, pero no al 100% en ramas (frontend branches 77.4%) — re-baseline 2026-08-08.

## 8. Document References

| Document | Path | Status |
|----------|------|--------|
| Executive Summary | `.context/PRD/executive-summary.md` | Generated 2026-08-08 |
| User Personas | `.context/PRD/user-personas.md` | Generated 2026-08-08 |
| User Journeys | `.context/PRD/user-journeys.md` | Generated 2026-08-08 |
| Feature Inventory | `.context/business/business-feature-map.md` | **Pending** — post-discovery via `/business-feature-map` |
| Business Model | `.context/business/business-model.md` | Generated 2026-08-08 (Phase 1) |
| Domain Glossary | `.context/business/domain-glossary.md` | Generated 2026-08-08 (Phase 1) |
| Architecture Specs | `.context/SRS/architecture.md` | **Pending** — Phase 2 SRS |
| Functional Specs | `.context/SRS/functional-specs.md` | **Pending** — Phase 2 SRS |
| Non-Functional Specs | `.context/SRS/non-functional-specs.md` | **Pending** — Phase 2 SRS |

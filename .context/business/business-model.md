# Business Model — route-optimizer (Delivery Route Planner)

> Confidence: High (fuentes en-repo: README, `.context/product.md`, `.context/modules/*.md`, docs/test-plan.md).
> Generated: 2026-08-08 · Discovery (reverse-engineering), no aspirational design.

## 1. Problem Statement

Las empresas de última milla deben asignar N destinos a una flota de vehículos, cada uno con capacidad, jornada y punto de partida. Sin optimización, el orden de visita es arbitrario y se desperdician horas de conducción (Source: `.context/product.md` §"Problema que resuelve").

La plataforma resuelve el problema planificando entregas: define vehículos (repartidores) y visitas (destinos con lat/lng), importa visitas masivas desde Excel y calcula rutas optimizadas que minimizan distancia y tiempo, dibujadas sobre un mapa (Source: `README.md` línea 3-6). El resultado se **persiste** con ciclo de vida pending→confirmed→completed/cancelled, lo que permite ejecutar y resolver cada parada (Source: `README.md` línea 14-18, `.context/modules/routing.md`).

El usuario objetivo es el **operador logístico**: crea vehículos y visitas, importa Excel, genera la ruta del día (Source: `.context/product.md` §"Usuarios"). La optimización es una heurística determinista tras la interfaz `routing.services.optimize_all`, intercambiable por OR-Tools, y la distancia se calcula por haversine (Source: `README.md` línea 14-19).

## 2. Business Model Canvas

| Block | Finding | Found in |
|-------|---------|----------|
| Customer Segments | Operador logístico (crea vehículos y visitas, importa Excel, genera la ruta del día) | `.context/product.md` §"Usuarios" |
| Value Propositions | Rutas optimizadas que minimizan distancia y tiempo; mapa gratuito (Leaflet/OSM, sin API key); importación masiva por Excel; heurística determinista (misma entrada → misma salida, testeable) | `README.md` l3-6, l12-13; `.context/product.md` §"Decisiones" #2 |
| Channels | Web app (React/Vite) consumiendo API REST; Excel como canal de entrada de datos masivos | `README.md` l10-12, l72-85 |
| Customer Relationships | Self-service (sin auth, sin login; AllowAny) | `backend/config/settings.py` (DEFAULT_PERMISSION_CLASSES = AllowAny) |
| Revenue Streams | Unknown — no hay señales de precios/planes/suscripción en el código | (none) |
| Key Resources | Motor de optimización (`routing.services.optimize_all`), datos de vehículos/visitas en SQLite, mapas OSM | `README.md` l14-18; `.context/modules/routing.md` |
| Key Activities | CRUD vehículos, CRUD visitas, import Excel, optimización + persistencia + ciclo de vida de rutas | `README.md` l58-68 |
| Key Partners | Ninguno externo en runtime (OSM mapas gratis; OR-Tools disponible como dependencia opcional en `requirements.txt` `ortools==9.15.*`) | `README.md` l12; `backend/requirements.txt` |
| Cost Structure | Local dev: SQLite (cero configuración), mapas gratis, sin servicios de pago detectados | `.context/product.md` §"Stack" |

## 3. Discovery Gaps

- [ ] Revenue Streams: sin señales de monetización en el código. Requiere confirmación del dueño del producto.
- [ ] Deployed environments (qa/staging/prod): solo local dev. No hay señal de clientes reales ni escala.
- [ ] Volumen de tráfico / usuarios reales: desconocido.
- [ ] Integraciones externas reales (API de mapas pagada, proveedor de geocoding): ninguna encontrada.

## 4. QA Relevance

| Business aspect | Testing implication |
|-----------------|---------------------|
| Rutas optimizadas minimizan distancia/tiempo | Validar métricas (`total_distance_km`, `total_duration_minutes`) contra cálculos esperados; test de rendimiento 300 visitas < 2s |
| Heurística determinista | Misma entrada → misma salida: tests de determinismo |
| Ciclo de vida persistente (pending→confirmed→completed/cancelled; stops delivered/failed) | State-transition testing por endpoint de transición |
| Capacidad dual kg/litros + ventanas horarias + jornada/almuerzo | Boundary/equivalence tests sobre asignación (capacidad, horarios, prioridad) |
| Import Excel con filas inválidas sin abortar | Validar reporte parcial `{created, errors[]}` |
| Sin auth (AllowAny) | QA sin setup de login; cubrir que el API es abierto |
| Mapa (Leaflet) | E2E debe validar render/markers; mockear react-leaflet en unit tests |

## 5. Sources Used

- `README.md` (líneas 1-86): problema, arquitectura, API, Excel.
- `.context/product.md` (todo): visión, usuarios, stack, decisiones, métricas de calidad.
- `.context/modules/routing.md`: algoritmo, ciclo de vida, endpoints, reglas.
- `.context/modules/vehicles.md`: contrato de datos vehículo, reglas de negocio.
- `.context/modules/visits.md`: contrato de datos visita, import Excel, reglas.
- `backend/config/settings.py`: auth (AllowAny), CORS, DB SQLite.
- `backend/requirements.txt`: dependencias (incl. ortools).
- `docs/test-plan.md`, `.context/qa/regression-report.md`: historias → ACs → casos.

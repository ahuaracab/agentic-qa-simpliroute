# Business Data Map — Delivery Route Planner

> Descubrimiento (reverse-engineering). Generado: 2026-08-09 · Fuentes: `../route-optimizer/backend` (Django 5.2 + DRF), `../route-optimizer/frontend` (React 19 + Vite + Leaflet), `.context/SRS/architecture.md`, `.context/PRD/*`, `.context/business/*`.

```
+-----------------------------------------------------------------------------+
|  DELIVERY ROUTE PLANNER                                                      |
|  Planificador de entregas de última milla: flota, destinos, optimización    |
|  determinista de rutas y ciclo de vida de planes por día.                    |
+-----------------------------------------------------------------------------+
```

## Resumen ejecutivo

La aplicación resuelve el problema operativo de planificar entregas de última milla: dados una **flota** (vehículos con depósito, doble capacidad kg/litros, jornada y ventana de almuerzo) y un conjunto de **destinos** (visitas con coordenadas, tiempo de servicio, prioridad, carga y ventana horaria opcional), el sistema **asigna y secuencia** cada visita a un vehículo para una fecha concreta, respetando capacidades, jornadas y ventanas, y produce un **plan ejecutable** (rutas + paradas) que se puede confirmar, completar, cancelar o resolver parada a parada.

El actor es un **único operador logístico/supervisor** (sin capa de usuarios/roles): la API es pública (`AllowAny`, sin auth). El valor está en pasar de planificar "a mano" a un plan persistente, determinista y auditable por día, con mapa (OpenStreetMap/Leaflet) y métricas de ruta (distancia, duración, horas de llegada/salida). El optimizador combina una **matriz real de calles** (OSRM) con un solver de **VRP** (OR-Tools); si cualquiera de los dos falla, degrada a una **heurística determinista** sin perder el servicio.

```
                     +----------------+
                     |  Operador       |
                     |  Logístico      |
                     +--------+-------+
                              | HTTP /api  (sin auth)
                              v
                    +---------------------+
                    |  Delivery Route     |
                    |  Planner (SPA React)|
                    |  4 tabs             |
                    +----------+----------+
                               | REST
                               v
                    +---------------------+       +---------------------+
                    |  Django REST API    |------>|  SQLite             |
                    |  (vehicles/visits/  |  ORM  |  db.sqlite3         |
                    |   routing)          |       +---------------------+
                    +----------+----------+
                               |
              +----------------+-----------------+
              v                                   v
     +----------------------+           +----------------------+
     | OSRM (router.project-|           | OR-Tools (VRP solver)|
     | osrm.org) matriz +   |           | optimización de rutas |
     | geometría de calles  |           +----------------------+
     +----------------------+
```

## Mapa de entidades

### Diagrama de relaciones

```
  VEHICLE (Vehículo)          VISIT (Visita)
  + id                        + id
  + name                      + name, address
  + capacity_kg, capacity_l   + latitude, longitude
  + avg_speed_kmh             + service_time_minutes
  + lat/lng (depósito)        + priority
  + work_start..lunch_end     + weight_kg, volume_l
  + created_at                + time_window_start/end
                              + created_at
       | 1                            | 1
       |                              |
       | has routes (PROTECT)         | scheduled as (PROTECT)
       v                              v
  +------------------ 1     N ------------------+
  |  OPTIMIZATION (Optimización)                 |
  |  + id, date, status (pending/confirmed/      |
  |    completed/cancelled)                      |
  |  + created_at, confirmed_at, completed_at    |
  +------------------ 1     N ------------------+
  +------------------ 1     N ------------------+
       |  OPTIMIZATIONROUTE (Ruta)               |
       |  + start/end_minutes, distance, dur     |
       |  + geometry (polilínea OSRM, JSON)      |
       +------------------ 1     N --------------+
       |  ROUTESTOP (Parada)                     |
       |  + sequence, arrival/departure_minutes  |
       |  + status (pending/delivered/failed)    |
       |  + resolved_at                          |
       +-----------------------------------------+
```

### Tabla de entidades

| Entidad | Rol de negocio | Por qué existe |
|---|---|---|
| **Vehicle** | Agente de entrega (camión/repartidor) con depósito, doble capacidad (kg y litros), velocidad media, jornada y ventana de almuerzo | Modela el **recurso físico** que ejecuta rutas; su depósito es el origen de la ruta y su capacidad/jornada limitan qué visitas puede atender |
| **Visit** | Destino de entrega con coordenadas, tiempo de servicio, prioridad, carga (kg/litros) y ventana horaria opcional | Modela la **demanda**: lo que hay que repartir; prioridad y ventana condicionan la selección dentro del plan |
| **Optimization** | Plan de un día: agrupa todas las rutas de una fecha y porta el ciclo de vida (pendiente → confirmada → completada / cancelada) | Da **entidad persistente y auditable** al acto de "optimizar": una fecha concreta produce un plan que se ejecuta y se historiza |
| **OptimizationRoute** | Asignación de un vehículo a una secuencia de paradas dentro de un plan, con métricas calculadas (distancia, duración, horas inicio/fin) | Conecta **flota → plan**: cada vehículo ocupado ese día tiene exactamente una ruta en la optimización; PROTECT impide borrar un vehículo con rutas |
| **RouteStop** | Una visita concreta posicionada en una ruta (sequence), con horas de llegada/salida planificadas y estado de resolución | Es el **nivel de ejecución**: solo aquí se registra si la entrega fue entregada o fallida, con su timestamp |

### Narrativa de relaciones clave

- **Optimization 1—N Route 1—N Stop**: el plan es el contenedor jerárquico. `OptimizationRoute.optimization` usa `CASCADE` (borrar plan borra rutas/paradas); `OptimizationRoute.vehicle` usa `PROTECT` (no se borra un vehículo que ya participó en rutas).
- **Visit 1—N RouteStop** (`PROTECT`): una visita puede aparecer como parada en distintos planes/días a lo largo del tiempo (histórico), pero no se borra si ya fue programada.
- **Reserva de recursos**: una optimización **pendiente o confirmada** "congela" a sus vehículos y visitas para esa fecha; cancelar o borrar el plan los libera. Esta regla vive en `routing/services.py` (`busy_vehicle_ids` / `unavailable_visit_ids`), no en la base.
- **Capacidad dual**: una visita cabe en un vehículo solo si suma de kg **y** litros no superan ambas capacidades — una sola dimensión no basta.

## Flujos de negocio

### Flujo 1 — Gestionar flota (vehículos)

```
Operador -> VehicleForm -> POST /api/vehicles/ -> vehicles_vehicle -> lista actualizada
             (búsqueda)  -> GET  /api/vehicles/?search=&page=   -> tabla paginada
             (borrar)    -> DELETE /api/vehicles/{id}/          -> 204
```

1. En la pestaña "Vehículos" el operador crea vehículos con nombre, doble capacidad, velocidad media, coordenadas de depósito, jornada y almuerzo.
2. Busca (server-side) y pagina la tabla. Borra vehículos sin rutas (PROTECT rechaza los que ya participaron).
3. **Reglas**: capacidades ≥ 0, velocidad ≥ 0.1, lat ∈ [-90,90], lon ∈ [-180,180]; jornada y almuerzo por defecto 08:00–18:00 / 13:00–14:00.

### Flujo 2 — Gestionar visitas (destinos)

```
Operador -> VisitForm   -> POST /api/visits/          -> visits_visit
Operador -> VisitImport -> POST /api/visits/import/   -> openpyxl -> visits_visit (bulk)
             (búsqueda) -> GET  /api/visits/?search=  -> tabla paginada
             (borrar)   -> DELETE /api/visits/{id}/   -> 204
```

1. Alta unitaria con coordenadas, tiempo de servicio, prioridad, carga y ventana horaria opcional.
2. **Importación masiva** desde Excel (`.xlsx`/`.xlsm`): columnas requeridas `name, latitude, longitude`; opcionales `address, service_time_minutes, priority, weight_kg, volume_l, time_window_start, time_window_end`. Las filas inválidas se registran en `errors` **sin abortar** las válidas (`visits/services.py`).
3. **Reglas**: servicio y prioridad ≥ 1; peso/volumen ≥ 0; coordenadas en rango.

### Flujo 3 — Crear una optimización y ver el plan

```
Operador -> tab "Optimizar ruta"
  1. GET /api/available/resources/?date=D     -> {vehicles[], visits[]} no ocupados
  2. selecciona (todo preseleccionado)        -> {vehicle_ids[], visit_ids[]}
  3. POST /api/optimizations/ {date, ids}     -> valida + optimiza + persiste
  4. 201 Optimization + routes[].stops + unassigned_visits
  5. mapa Leaflet/OSM con polylines por ruta + markers depósito/parada
```

1. El operador elige una fecha (por defecto hoy); la UI consulta **disponibilidad real** para ese día.
2. Preselecciona todos los vehículos y visitas disponibles; puede deseleccionar.
3. `POST /api/optimizations/` valida (ids existen, vehículos no ocupados, visitas no no-disponibles) → `optimize_all` → persiste `Optimization` + `OptimizationRoute`s + `RouteStop`s (sequence 1..n).
4. El plan devuelve `unassigned_visits`: visitas que no cupieron por capacidad; la UI muestra advertencia.
5. El mapa dibuja una polilínea por ruta (depósito → paradas) con marcadores y popups; `FitBounds` encuadra el área.
6. **Reglas**: `date` obligatoria (400 si falta); el optimizador intenta OSRM+OR-Tools (si ≤ 100 nodos) y degrada a heurística ante cualquier fallo; la heurística es determinista (prioridad desc → id asc, asignación a depósito más cercano, orden nearest-neighbor).

### Flujo 4 — Ejecutar el plan (ciclo de vida)

```
pending  --Confirmar-->  confirmed  --Entregar/Fallar (por parada)-->  resolved
confirmed  --Completar-->  completed
pending|confirmed  --Cancelar-->  cancelled (terminal)
```

1. El operador confirma el plan (solo desde `pending`).
2. En `confirmed`, cada parada pendiente se resuelve con **Entregar** (`deliver`) o **Fallar** (`fail`); el plan solo acepta resolución de sus propias paradas, una sola vez cada una.
3. Con el plan confirmado puede **Completarse** (solo desde `confirmed`).
4. Un plan **pendiente o confirmado** puede **Cancelarse** (terminal); borrar (`DELETE`) es posible en cualquier estado y libera recursos.
5. **Reglas** (aplicadas en `routing/views.py`, no en DB): confirm solo pending; complete solo confirmed; cancel solo pending|confirmed; deliver/fail requieren optimización confirmada + parada pendiente y perteneciente al plan. Los timestamps `confirmed_at`/`completed_at`/`resolved_at` se registran en cada transición.

### Flujo 5 — Histórico y gestión de optimizaciones

```
Operador -> tab "Optimizaciones" -> GET /api/optimizations/
   -> acordeón por plan: fecha, estado, nº rutas, nº paradas, métricas
   -> Cancelar (pending|confirmed) / Eliminar (cualquier estado)
```

1. El operador revisa el historial de planes por día (sin paginación en UI, aunque la API pagina).
2. Expande un plan para ver cada ruta (vehículo, distancia, duración, inicio/fin) y sus paradas ordenadas con estado.
3. Cancela o elimina planes; ambos liberan los recursos reservados (verificable: `test_cancel_frees_vehicle`).

## Máquinas de estado

### Optimization (Optimización)

```
             confirm                  complete
  pending ────────────▶ confirmed ────────────▶ completed
     │                    │
     │ cancel             │ cancel
     ▼                    ▼
  cancelled (terminal)  cancelled (terminal)
```

| From | To | Event | Efectos |
|---|---|---|---|
| pending | confirmed | POST /{id}/confirm/ | set `confirmed_at`; libera botones de resolución de paradas |
| confirmed | completed | POST /{id}/complete/ | set `completed_at`; paradas quedan de solo lectura |
| pending | cancelled | POST /{id}/cancel/ | estado terminal; libera recursos del día |
| confirmed | cancelled | POST /{id}/cancel/ | estado terminal; libera recursos del día |
| * | (borrado) | DELETE /{id}/ | cascade de rutas y paradas; libera recursos |

**Reglas**: no hay reapertura ni re-completado (cancelled y completed son terminales); `status` es read-only en el serializador → solo cambia por estas acciones; validadores devuelven 400 con mensajes en español si la transición es ilegal.

### RouteStop (Parada)

```
  pending ──deliver──▶ delivered   (set resolved_at)
  pending ──fail─────▶ failed      (set resolved_at)
```

| From | To | Event | Efectos |
|---|---|---|---|
| pending | delivered | POST /{id}/stops/{stop}/deliver/ | set `resolved_at`; la visita queda entregada (no re-planificable) |
| pending | failed | POST /{id}/stops/{stop}/fail/ | set `resolved_at`; la visita fallida solo es re-planificable desde el día siguiente |

**Reglas**: la optimización debe estar `confirmed`; la parada debe pertenecer al plan; la parada debe estar `pending` (400 "La parada ya fue resuelta.").

### Disponibilidad de recursos (reglas de negocio)

```
 VEHICLE: ocupado si existe ruta en optimización pending|confirmed ese día
          → no ofertado en /available/resources/
 VISIT:   no disponible si (a) entregada alguna vez, (b) stop pending|confirmed
          el mismo día, (c) fallida el mismo día en plan confirmed|completed
          (reintento solo desde el día siguiente)
 Cancel/Delete de un plan  → libera vehículos y visitas del día
```

## Procesos automáticos

| Tipo | Proceso | Disparador | Por qué existe |
|---|---|---|---|
| En request | Cálculo de optimización (OSRM + OR-Tools) | `POST /api/optimizations/` síncrono | Genera el plan en el momento; sin cola de fondo |
| En request | Fallback heurístico | Falla de OSRM u OR-Tools (try/except silencioso) | Garantiza el servicio aunque el routing externo caiga |
| Manual | `seed_demo` (management command) | `python manage.py seed_demo` | Puebla flota/destinos demo alrededor de Quito |
| Manual | `generate_sample_xlsx.py` | script dev | Genera plantilla Excel para importación |
| CI | `qa.yml` (pytest + vitest + tsc) | push/PR a main | Gate de calidad; **sin cron** (no es scheduled) |

**Nota**: no hay señales Django, Celery, cron ni webhooks en el backend. Todo "procesamiento automático" ocurre dentro de la petición HTTP de optimización.

## Integraciones externas

### OSRM — router de calles (backend)

```
 POST /optimizations/
    -> GET {ROUTING_OSRM_URL}/table/v1/driving/{...}   matriz dist/tiempo
    -> GET {ROUTING_OSRM_URL}/route/v1/driving/{...}    geometría (polyline5 -> [[lat,lon]])
    -> vrp.solve(vehicles, visits, dist_km, time_min)
```

- **Flujo dependiente**: creación de optimización (Flujo 3); solo si `ROUTING_OSRM=1` y nodos ≤ 100.
- **Datos que impactan**: distancia/duración reales de calles y geometría de la polilínea que dibuja el mapa.
- **Fallo**: timeout 5s → devuelve `None` → degrade a matriz haversine o heurística; la UI jamás ve el fallo (el plan sale igual).

### OR-Tools — solver VRP (backend)

- **Rol**: resuelve la asignación/secuencia con restricciones de doble capacidad, jornada/almuerzo y ventanas horarias; penaliza fuertemente saltar visitas de alta prioridad.
- **Fallo**: excepción → catch en `optimize_all` → heurística determinista.

### OpenStreetMap — tiles de mapa (frontend)

- **Rol**: render del mapa y polylines en RouteOptimizer (`tile.openstreetmap.org`, sin API key).
- **Fallo**: el mapa queda en blanco/sin tiles (cosmético); el plan y los datos no dependen de él.

### Excel — importación masiva de visitas (frontend→backend, openpyxl)

- **Rol**: ingesta de visitas desde archivo `.xlsx`/`.xlsm` con columnas definidas.
- **Fallo**: filas inválidas se descartan en `errors` (parcial); archivo con extensión no permitida → 400.

## Discovery Gaps

- [ ] **Sin auth (AllowAny)** — todo `/api/*` es público; se asume un único rol de operador. No hay usuarios/permisos que mapear; riesgo de seguridad conocido (risk-assessment #1-3: SECRET_KEY hardcodeada, DEBUG=True, CORS abierto).
- [ ] `geometry` (polilínea OSRM) — estructura exacta no validada con datos reales (tests corren con `ROUTING_OSRM=False`).
- [ ] Sin OpenAPI publicado — contrato no consumible por `bun run api:sync`; `unassigned_visits` solo viaja en la respuesta del POST, no se persiste.
- [ ] Reintento de visitas fallidas — regla "solo desde el día siguiente" no cubierta por tests del SRS.
- [ ] Import Excel con columnas duplicadas — gana la última; sin test que lo fije.
- [ ] Ventanas horarias — solo `time` (sin fecha), planificación de un solo día; cruce de medianoche no contemplado.
- [ ] Histórico — UI de Optimizaciones no pagina (ignora la paginación de la API).
- [ ] `MAILERS` en `settings.py:149` (probable typo de `EMAIL`), sin uso — no mapeado como integración.

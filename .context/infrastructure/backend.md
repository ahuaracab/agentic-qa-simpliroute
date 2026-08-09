# Infrastructure — Backend (Delivery Route Planner)

> Fase 3 Infrastructure Discovery · Generado: 2026-08-08 · Discovery read-only sobre el target (`C:\laragon\www\route-optimizer\backend`). No se modificó código del target.
> Stack detectado: **Django + DRF** (señales: `backend/requirements.txt` con `Django==5.2.*`, `manage.py`, `config/settings.py`). No hay `pyproject.toml` — package manager = **pip + requirements.txt**.
> Convención: los identificadores técnicos (paths, env var names, comandos, settings) se mantienen en inglés; el contenido está en español para el equipo QA chileno.

## Runtime Environment

| Aspecto | Hallazgo | Evidencia |
|---------|----------|-----------|
| Runtime | Python 3.13.3 (venv local) / 3.13 (CI) | `backend/.venv/pyvenv.cfg` (version = 3.13.3); `.github/workflows/qa.yml:16,61` (`python-version: '3.13'`) |
| Lenguaje | Python 3.13 | `requirements.txt`, `README.md:11` |
| Framework | Django 5.2 LTS (`Django==5.2.*`) | `backend/requirements.txt:1` |
| API framework | Django REST Framework 3.16 (`djangorestframework==3.16.*`) | `backend/requirements.txt:2` |
| Package manager | pip (`pip install -r requirements.txt`) — no `pyproject.toml`/Poetry/uv | `requirements.txt`; `qa.yml:19,67` |
| Versionado de Python | Sin `.python-version` ni `.tool-versions` | glob en raíz de monorepo y `backend/` → sin hallazgo |
| Apps | `vehicles`, `visits`, `routing` (Django) | `config/settings.py:43-45` |
| Server | `manage.py runserver` (dev); `wsgi`/`asgi` expuestos (`config.wsgi`, `config.asgi`) | `config/wsgi.py:14`, `config/asgi.py:14` |

> Nota: `.venv` incluye paquetes transitivos (p. ej. pandas) que NO están declarados en `requirements.txt` — son dependencias indirectas de `ortools`; la lista oficial de dependencias es solo `requirements.txt`.

## Package Scripts

No existe `package.json` en `backend/` ni Makefile — los "scripts" son comandos de Django/pytest/scripts ad-hoc:

| Comando | Propósito |
|---------|-----------|
| `.venv/Scripts/python.exe -m pytest` | Suite completa backend con cobertura (gate ≥85%) |
| `.venv/Scripts/python.exe -m pytest -m smoke --cov-fail-under=0` | Smoke rápido (8 tests marcados `@pytest.mark.smoke`); `--cov-fail-under=0` evita el gate al correr subset |
| `.venv/Scripts/python.exe -m pytest -m slow --cov-fail-under=0` | Rendimiento/volumen (1 test marcado `@pytest.mark.slow`; 300 visitas < 2 s) |
| `python manage.py runserver 8000` | Servidor dev en http://127.0.0.1:8000 |
| `python manage.py migrate` | Aplica migraciones (BD dev) |
| `python manage.py seed_demo` | Seed de demostración (100 vehículos + 1000 visitas por defecto) |
| `python scripts/generate_sample_xlsx.py [--suffix N] [--out RUTA]` | Genera `sample_visits.xlsx` para import masivo de visitas |

Fuente: `README.md:27-39,80-83`, `backend/vehicles/management/commands/seed_demo.py:18-22`, `backend/pytest.ini:5-8`. (`scripts/e2e_serve.py` y `db.e2e.sqlite3` fueron eliminados del target el 2026-08-08 — el E2E corre desde `agentic-qa-simpliroute`).

## Core Dependencies

| Categoría | Paquete | Versión (requirements.txt) | Propósito | Evidencia |
|-----------|---------|----------------------------|-----------|-----------|
| Framework | Django | `5.2.*` | Web framework / ORM / admin | `requirements.txt:1` |
| API framework | djangorestframework | `3.16.*` | DRF: routers, ViewSets, serializers, paginación | `requirements.txt:2` |
| CORS | django-cors-headers | `4.9.*` | Middleware CORS (`corsheaders.middleware.CorsMiddleware`) | `requirements.txt:3`; `settings.py:50` |
| Excel import | openpyxl | `3.1.*` | Lectura de `.xlsx` en `visits/services` (import masivo) | `requirements.txt:4`; `scripts/generate_sample_xlsx.py:8` |
| HTTP client | requests | `2.32.*` | Cliente OSRM (matriz + geometría) | `requirements.txt:5`; `routing/osrm.py:1,58` |
| OR-Tools | ortools | `9.15.*` | Solver VRP (`routing/vrp.solve`) cuando el path OSRM está activo | `requirements.txt:6`; `routing/vrp.py:1` |
| Test runner | pytest | `9.1.*` | Suite de tests | `requirements.txt:7` |
| Test integración Django | pytest-django | `4.13.*` | Fixture `settings`, `DJANGO_SETTINGS_MODULE` | `requirements.txt:8`; `pytest.ini:2` |
| Cobertura | pytest-cov | `7.1.*` | Reporte term + html, gate `--cov-fail-under=85` | `requirements.txt:9`; `pytest.ini:5` |

> Validación: validadores de Django en campos de modelo (p. ej. lat/lon, capacidades) — `vehicles/models.py`, `visits/models.py`, `routing/serializers.py` (ver SRS architecture.md §Security). No hay Pydantic/Zod: la validación es Django validators + DRF serializers.

## Environment Variables

No existe `.env.example` ni `.env.template` en el repositorio (búsqueda recursiva sin hallazgo). Las variables se documentan desde `os.environ.get` en `config/settings.py` + `manage.py`/`wsgi`/`asgi`. `.gitignore:28-30` ignora `.env` y `.env.local`. **No se registran valores de secretos — solo KEY + formato.**

### Required

Ninguna variable es estrictamente requerida: el proyecto arranca con todos los defaults (diseño dev-first).

| Variable | Formato / Valor esperado | Nota |
|----------|--------------------------|------|
| `DJANGO_SETTINGS_MODULE` | `config.settings` | `setdefault` en `manage.py:9`, `config/wsgi.py:14`, `config/asgi.py:14` — se auto-carga; solo se necesita si se quiere override |

### Optional (tiene default)

| Variable | Default | Tipo | Evidencia |
|----------|---------|------|-----------|
| `DJANGO_DB_NAME` | `BASE_DIR/db.sqlite3` | Ruta (string) | `settings.py:98,102` — si se define, usa ese path SQLite (históricamente el e2e usaba `db.e2e.sqlite3`; hoy el E2E vive en `agentic-qa-simpliroute` con su propio manejo de BD) |
| `ROUTING_OSRM` | `1` | Flag ("1" → True) | `settings.py:61` — activa/desactiva el path OSRM+OR-Tools |
| `ROUTING_OSRM_URL` | `https://router.project-osrm.org` | URL | `settings.py:62` |
| `ROUTING_OSRM_TIMEOUT` | `5` | Float (segundos) | `settings.py:63` |
| `ROUTING_OSRM_MAX_NODES` | `100` | Int (nodos) | `settings.py:64` — si la matriz supera este límite, fallback heurístico |

### External Service

| Variable | Servicio | Formato | Evidencia |
|----------|----------|---------|-----------|
| `ROUTING_OSRM_URL` | OSRM public router (`router.project-osrm.org`) | `https://<host>` | `settings.py:62`; `routing/osrm.py:9-10` — solo se consulta si `ROUTING_OSRM=1` y ≤ `ROUTING_OSRM_MAX_NODES`; fallback a haversine ante error/timeout (`osrm.py:64-65,82-83`) |

> SECURITY: `SECRET_KEY` está **hardcodeada** en `settings.py:24` (no proviene de env var) — riesgo ALTO registrado en `risk-assessment.md` #1. `CORS_ALLOW_ALL_ORIGINS = True` (`settings.py:59`) y `ALLOWED_HOSTS = ['*']` (`settings.py:29`) también son hardcoded — riesgos #3 y #2.

## Database Configuration

| Aspecto | Hallazgo | Evidencia |
|---------|----------|-----------|
| Tipo | SQLite (file) | `settings.py:101` (`django.db.backends.sqlite3`) |
| Provider | Local file — intercambiable por Postgres (documentado en `.context/product.md`) | `project-config.md` §Database |
| Archivos | `backend/db.sqlite3` (dev) | `settings.py:102` |
| ORM | Django ORM (integrado) | — |
| Migration tool | Django migrations | `routing/migrations/` (0001 + 0002_optimizationroute_geometry), `vehicles/migrations/` (0001 + 0002), `visits/migrations/` (0001 + 0002) |
| Seed mechanism | Custom management command `seed_demo` | `vehicles/management/commands/seed_demo.py:17-68` |
| Pooling | N/A (SQLite single-file, sin pool) | — |
| Query optimization | `prefetch_related("routes__stops__visit", "routes__vehicle")` en queryset de `OptimizationViewSet` | `routing/views.py:16` |

## Migration Commands

```bash
cd backend

# Create — nueva migración (auto-detecta cambios de modelo)
python manage.py makemigrations <app>

# Apply — aplica migraciones pendientes (dev)
python manage.py migrate

# Reset (dev) — borrar BD + re-migrar desde cero
Remove-Item db.sqlite3; python manage.py migrate

# Seed — datos demo (default: 100 vehículos + 1000 visitas; idempotente por nombre)
python manage.py seed_demo
python manage.py seed_demo --vehicles 50 --visits 500   # cantidades custom

# Reset + seed en un solo paso (dev)
Remove-Item db.sqlite3; python manage.py migrate; python manage.py seed_demo
```

> E2E: no hay scripts de e2e en el target (eliminados 2026-08-08). El backend se levanta manualmente (`python manage.py runserver 8000`) para que el runner de `agentic-qa-simpliroute` (Playwright propio, sin webServer) apunte a `127.0.0.1:8000`.

## Build Configuration

| Aspecto | Hallazgo | Evidencia |
|---------|----------|-----------|
| Build step | Ninguno — backend Python puro, sin compilación | — |
| Container | Sin `Dockerfile` ni `docker-compose.yml` en el monorepo | glob raíz |
| Static files | `STATIC_URL = 'static/'` | `settings.py:141` |
| WSGI / ASGI | `config.wsgi.application` / `config.asgi.application` | `settings.py:92`; `config/wsgi.py`, `config/asgi.py` |
| Output dirs | `htmlcov/` (cobertura pytest), `backend/__pycache__/` | `pytest.ini:5`; `.gitignore:4,8` |
| Lint/type-check | Ninguno para backend (sin ruff/flake8/black; sin pre-commit) | `risk-assessment.md` #5 |

## Local Development Setup

Recipe copy-pasteable (Windows PowerShell, flujo del README del target):

```bash
# 1. Instalar dependencias
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 2. Entorno — NO hay .env.example; las env vars son opcionales (defaults dev).
#    Solo se definen si se quiere sobreescribir, p. ej.:
#    $env:ROUTING_OSRM = "0"        # desactivar OSRM/OR-Tools (path heurístico)
#    $env:DJANGO_DB_NAME = "C:\tmp\mi_bd.sqlite3"   # BD alternativa

# 3. Base de datos
python manage.py migrate
python manage.py seed_demo          # opcional: datos demo

# 4. Levantar el servidor dev
python manage.py runserver 8000     # API en http://127.0.0.1:8000

# 5. Verificar (no existe /api/health — ver Health Check)
curl http://127.0.0.1:8000/api/vehicles/   # esperado: 200 + lista paginada
```

> El frontend corre aparte (`npm install && npm run dev` en `frontend/`, puerto 5173, proxy `/api` → :8000) — ver `frontend.md` / `README.md:52-56`.

## Health Check Endpoints

**No existe ningún endpoint de health check.** `grep` de `health|status/|ping` sobre `backend/**` (excluyendo `.venv`) devolvió solo `test_shifts_service_to_lunch_end_when_overlapping` (`routing/tests.py:196`, un test de horarios, no un endpoint). Rutas registradas en `config/urls.py:20-25`: `/admin/` y `/api/` (vehicles, visits, routing).

| Endpoint | Estado |
|----------|--------|
| `/api/health`, `/api/status`, `/healthz`, `/ping` | **No implementado** (gap) |

## Auth

| Aspecto | Hallazgo | Evidencia |
|---------|----------|-----------|
| Authentication | `DEFAULT_AUTHENTICATION_CLASSES: []` (vacío) | `settings.py:69` |
| Authorization | `DEFAULT_PERMISSION_CLASSES: ['rest_framework.permissions.AllowAny']` | `settings.py:70-72` |
| Conclusión | API completamente abierta, sin sesiones/tokens | `SRS/architecture.md` §Security (coincide) |

## Discovery Gaps

- [ ] No existe `.env.example` / `.env.template` — la lista de variables se derivó de `os.environ.get` en código; falta plantilla oficial para documentar el contrato de env.
- [ ] No hay endpoint de health check (`/api/health` o similar) — sin señal de liveness/readiness para monitoreo o smoke de CI.
- [ ] `SECRET_KEY`, `DEBUG=True`, `ALLOWED_HOSTS=['*']`, `CORS_ALLOW_ALL_ORIGINS=True` hardcodeados en `config/settings.py:24,27,29,59` — sin configuración env-based de producción (riesgos #1, #2, #3 de `risk-assessment.md`).
- [ ] No hay `.python-version` ni `.tool-versions` — la versión de Python (3.13) se infiere de `.venv/pyvenv.cfg` y de `qa.yml`; no hay pin explícito en el repo.
- [ ] Sin build/lint/type-check backend: no hay ruff/black/flake8 ni pre-commit (riesgo #5 de `risk-assessment.md`).
- [ ] Versiones declaradas con wildcard (`Django==5.2.*`, `DRF==3.16.*`, etc.) — no hay lockfile de pip; la versión exacta instalada puede derivar dentro del minor.
- [ ] CI nunca ejecutado en la práctica (repo con 0 commits en el momento de este discovery) — `qa.yml` existe pero sus comandos no están verificados end-to-end (riesgo #4).
- [ ] Sin OpenAPI spec publicada (`OPENAPI_SPEC_PATH=` vacío) — el contrato API no es consumible por `bun run api:sync`; se cubre vía `/business-api-map` (riesgo #6; gap heredado de `SRS/architecture.md` §Discovery Gaps).
- [ ] Formato exacto del `geometry` de OSRM (polilínea decodeada) no validado contra datos reales en tests (gap heredado de `SRS/architecture.md` §Discovery Gaps).

## QA Relevance

| Área QA | Qué verificar | Notas |
|---------|---------------|-------|
| Comandos de test locales | Usar EXACTAMENTE `.venv/Scripts/python.exe -m pytest` (CI usa `python -m pytest` en Ubuntu). El gate de cobertura es `--cov-fail-under=85` (impuesto por `pytest.ini:5`) | Correr el subset con `-m smoke`/`-m slow` requiere `--cov-fail-under=0` para no fallar por cobertura parcial (AGENTS.md) |
| Aislamiento OSRM en tests | `conftest.py:4-5` fuerza `settings.ROUTING_OSRM = False` (autouse) — **toda la suite unit/API corre con el path heurístico, jamás contra OSRM real** | No mockear OSRM manualmente: el fixture ya lo desactiva |
| Marcadores | `smoke` (8 tests) y `slow` (1 test de performance) declarados en `pytest.ini:6-8` | El reporte `htmlcov/index.html` es el artifact de cobertura; CI lo sube desde `backend/htmlcov/` |
| E2E con BD real | El E2E ya no vive en el target: `scripts/e2e_serve.py` y `db.e2e.sqlite3` fueron eliminados (2026-08-08). El runner E2E es `agentic-qa-simpliroute` — el backend se levanta manualmente con `db.sqlite3` dev (o una BD separada vía `DJANGO_DB_NAME`) | `agentic-qa-simpliroute/playwright.config.ts` (sin webServer) |
| Sin auth | La API es `AllowAny` sin autenticación — los tests de API no requieren tokens/login | Aceptado para discovery/QA (`risk-assessment.md` #9) |
| Env para QA local | Solo si se prueba el path OSRM real: `ROUTING_OSRM=1` + `ROUTING_OSRM_URL` (timeout 5 s, máx 100 nodos) | `settings.py:61-64` |
| Seed para QA | `python manage.py seed_demo` genera datos estables (idempotente por nombre) para pruebas con volumen | `seed_demo.py:32-33,52-53` |

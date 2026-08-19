# Evaluación de Riesgos — route-optimizer

> Generado: 2026-08-08 · Fase 1 Project Assessment. Discovery read-only — nada en el repo target fue modificado. Los valores de secretos NUNCA se registran; solo rutas + severidad.
> Re-baselineado: 2026-08-08 (post-implementación). El target cambió tras la evaluación inicial — nueva feature frontend "Optimizaciones" (listar/cancelar/eliminar optimizaciones), 60 unit tests en 10 archivos (antes 54/9), 91.86% cobertura de líneas (antes 92.21%). Código backend sin cambios.

## ALTO

| # | Riesgo | Severidad | Descripción | Impacto | Recomendación | Owner |
|---|--------|-----------|-------------|---------|----------------|-------|
| 1 | `SECRET_KEY` hardcodeada | ALTO | `backend/config/settings.py:24` trae una secret key de desarrollo de Django en código; no se carga desde `.env`/env var | Si se despliega tal cual, riesgo de falsificación de sesión/crypto; el secreto es público en el repo | Mover a env var (`DJANGO_SECRET_KEY`), rotarla, nunca desplegar con la key commiteada | Backend dev |
| 2 | `DEBUG = True` + `ALLOWED_HOSTS = ['*']` | ALTO | `settings.py:27,29` defaults de desarrollo, sin hardening de producción | Divulgación de info de páginas de error + ataques host-header si se expone | Config basada en env: `DEBUG=False` + hosts explícitos en prod | Backend dev |

## MEDIO

| # | Riesgo | Severidad | Descripción | Impacto | Recomendación | Owner |
|---|--------|-----------|-------------|---------|----------------|-------|
| 3 | `CORS_ALLOW_ALL_ORIGINS = True` | MEDIO | `settings.py:59` permite cualquier origin | Acceso cross-origin a la API abierta | Restringir a los origins conocidos del frontend en prod | Backend dev |
| 4 | CI nunca ejecutado | MEDIO | `.github/workflows/qa.yml` bien diseñado (3 jobs, gates de cobertura, artifacts) pero el repo tiene 0 commits — todo untracked, el workflow está sin probar | Sin señal de que los gates de CI realmente pasen | Primer commit + push a main para ejercitar qa.yml | Repo owner |
| 5 | Sin tooling de lint/format/pre-commit | MEDIO | Sin ruff/black/flake8 (backend), sin eslint/prettier/husky (frontend); sin config pre-commit | Estilo no impuesto, regresiones no detectadas por tooling | Adoptar ruff (backend) + eslint/prettier (frontend) post-discovery | Repo owner |
| 6 | Sin spec OpenAPI publicada | MEDIO | Proyecto DRF sin endpoint de schema; `OPENAPI_SPEC_PATH=` vacío en `.env` de QA | Bloquea `bun run api:sync` (tipos técnicos); el contrato de API debe derivarse a mano | Exponer schema (drf-spectacular) en el target; mientras tanto usar `/business-api-map` | Backend dev |
| 7 | `routing/test_vrp.py` se cuelga (solver VRP sin límite en instancias pequeñas) | MEDIO | `routing/vrp.py:88` solo aplica `search_parameters.time_limit = 3s` cuando `node_count > 50`; para instancias de 2-6 nodos corre `GUIDED_LOCAL_SEARCH` sin límite → se comporta como HANG, y los tests 1-2 fallan (asignación distinta a la heurística esperada). Bug pre-existente (descubierto 2026-08-09, no introducido por cambios de seguridad). `test_vrp.py` tiene 14 tests | La suite completa nunca termina → el gate de cobertura (≥85%) deja de ser un go/no-go válido | Aplicar `time_limit` para todo tamaño de instancia; revisar por qué la solución del solver no coincide con la heurística en capacidad acotada | Backend dev |

## BAJO

| # | Riesgo | Severidad | Descripción | Impacto | Recomendación | Owner |
|---|--------|-----------|-------------|---------|----------------|-------|
| 8 | Docs stale en el target | BAJO | README afirma 74 backend tests (real: 88); AGENTS afirma 6 smoke (real: 4) | Señales engañosas para futuras sesiones | Actualizar conteos en docs del target | Repo owner |
| 9 | Bloque `MAILERS` muerto | BAJO | `settings.py:149` dict probablemente typo de config EMAIL, sin uso | Confusión; config muerta | Revisar/eliminar en el target | Backend dev |
| 10 | Sin auth en la API | BAJO | `DEFAULT_PERMISSION_CLASSES = AllowAny`, sin authentication classes | API abierta — aceptable para proyecto de ejemplo; debe abordarse antes de cualquier despliegue real | Confirmado aceptable para discovery/QA | Repo owner |
| 11 | Specs e2e no typecheckeados | BAJO | `tsconfig.json` include = `["src", "vite.config.ts"]` — `e2e/` excluido de `tsc --noEmit` | Errores de TS en e2e solo salen en runtime | Agregar `e2e/` a un tsconfig dedicado | Frontend dev |
| 12 | Side-effect de probe del backend | BAJO | `pytest --collect-only` (sin `--no-cov`) reescribió `backend/htmlcov/` con data de solo-colección (22%); el reporte 89% previo fue sobreescrito | El artifact de cobertura en disco ya no refleja un run completo | Re-correr `python -m pytest` completo para restaurar htmlcov preciso | QA |

## Discovery Gaps

- [ ] Issue tracker: none exists (route-optimizer es un proyecto de ejemplo sin historias Jira/Notion). Fase 4 backlog mapping bloqueada por diseño.
- [ ] Entornos desplegados (qa/staging/prod): no encontrados; solo URLs locales de dev.
- [ ] Contactos del equipo: no proporcionados.
- [ ] Acceso MCP DBHub/OpenAPI: no configurado.

> Nota: el discovery es read-only sobre el repo target. Las recomendaciones arriba se registran para los owners del target; NO se ejecutan aquí.

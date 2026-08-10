# Adapt Framework Plan — agentic-qa-simpliroute

> Generado: 2026-08-10
> Proyecto: agentic-qa-simpliroute (target: Delivery Route Planner)
> Estado: **COMPLETED** — fases 3-9 ejecutadas y validadas el 2026-08-10

---

## 1. Project Summary

- **Stack del target**: backend Django 5.2 LTS + DRF (Python 3.13, `../route-optimizer/backend`, entry `routing/`), frontend React 19 + Vite + TS + Leaflet (`../route-optimizer/frontend`, entry `src/`).
- **Auth**: NINGUNA — API pública (`AllowAny`), sin login, sin token, sin roles.
- **Entidades principales**: Vehicle (FEAT-001), Visit (FEAT-002/003), Optimization + OptimizationRoute + RouteStop (FEAT-005..009).
- **DB**: SQLite local (`../route-optimizer/backend/db.sqlite3`).
- **Entornos**: solo `local` operativo (frontend `127.0.0.1:5173`, API `127.0.0.1:8000`). No hay staging/qa/prod desplegados.
- **OpenAPI**: no publicada (drf-spectacular no instalado en el target).

## 2. Auth Strategy

**NONE — eliminar la capa de auth completa** (decisión del usuario 2026-08-10).

- El target no emite token ni cookie. No existe login que probar.
- Se borran: `AuthApi.ts`, `LoginPage.ts`, `api-auth.setup.ts`, `ui-auth.setup.ts`, `.auth/`, la sección `auth` de `config/variables.ts`, y los proyectos `ui-setup` / `api-setup` de `playwright.config.ts`.
- `scripts/api-login.ts` y el maneuver de curl autenticado (`api:login` → `.auth/tokens.env`) quedan **fuera de alcance** (no aplican): no hay token que acuñar. El manejo de curl para el agente usará la API pública sin header de auth.
- No hay storageState ni sesión reutilizable: cada proyecto corre sin sesión.
- La verificación de credenciales en `config/validateTestEnv.ts` se ajusta: sin auth, no se exigen `*_USER_EMAIL` / `*_USER_PASSWORD`.

## 3. OpenAPI Strategy

**Facades escritas a mano + deshabilitar MCP `openapi`** (decisión del usuario 2026-08-10).

- Sin spec: `bun run api:sync` no tiene fuente. No se genera `api/openapi.json` ni `api/openapi-types.ts`.
- Se crea `api/schemas/vehicle.types.ts` **a mano** desde el contrato real (`VehicleSerializer`: `id, name, capacity_kg, capacity_l, average_speed_kmh, latitude, longitude, work_start, work_end, lunch_start, lunch_end, created_at`). Sin import de `@openapi` (alias muerto — no existe `openapi-types.ts`).
- Se actualiza `api/schemas/index.ts` con la re-export de `vehicle.types`.
- Se deshabilita el server `openapi` en **ambos** archivos: `.mcp.json` y `opencode.jsonc`.
- Gap registrado: `drf-spectacular` en el target habilitaría `api:sync` real + tipos automáticos.

## 4. Identity + Variables

### `.agents/project.yaml`
- `project.project_key`: `ROUTE` (provisional, decisión del usuario; reemplazable cuando el tracker Notion defina el slug).
- `backend.*`, `frontend.*`, `database.db_type: sqlite`, `issue_tracker: notion` → ya correctos, sin cambios.
- `testing.default_env`: `local` (ya).
- `environments.local`: `web_url`/`api_url` ya correctos; añadir `db_mcp: dbhub` y `api_mcp: null` (openapi deshabilitado).
- `environments.{qa,staging,production}`: quedan declarados con URLs `null` (no hay deploys). No se inventan URLs.

### `.env`
- `TEST_ENV=local`.
- `API_BASE_URL=http://127.0.0.1:8000` (base de curl del agente).
- `OPENAPI_SPEC_PATH=` vacío (MCP deshabilitado).
- `DBHUB_TYPE=sqlite`, `DBHUB_DATABASE=../route-optimizer/backend/db.sqlite3`, resto de `DBHUB_*` vacíos (sqlite no usa host/user/password).
- Sin `<ENV>_USER_EMAIL` / `<ENV>_USER_PASSWORD` (no hay auth).
- `AUTO_SYNC=false`, TMS sin configurar (gap ya conocido).

### `config/variables.ts`
- `envDataMap`: `local.base = http://127.0.0.1:5173`, `local.api = http://127.0.0.1:8000/api`. `staging` queda con los valores heredados hasta que exista un host (o se retira del union).
- Se elimina la sección `config.auth` (loginEndpoint, meEndpoint, storageStatePath, apiStatePath, tokenLifetimeSeconds).
- `config.testUser` se elimina (sin credenciales).
- El union `Environment` se mantiene `'local' | 'staging'` (reconciliación 4-vías con `validateTestEnv.ts` y workflows — ambos se alinean a `local` como único activo).

### Reconciliación de entornos (4-vías)
1. `config/variables.ts` → union + envDataMap.
2. `.agents/project.yaml` → `environments` + `default_env`.
3. `config/validateTestEnv.ts` → ajustar: sin credenciales requeridas.
4. `.github/workflows/*.yml` → `inputs.environment.options: [local]`.

## 5. Components to Create / Modify

### Crear
| Archivo | Contenido |
|---|---|
| `tests/components/api/VehicleApi.ts` | KATA L3 API: ATCs `listVehiclesSuccessfully`, `createVehicleSuccessfully`, `createVehicleWithInvalidData`, `deleteVehicleSuccessfully` con `@atc('ROUTE-201')`… `@atc('ROUTE-204')` |
| `api/schemas/vehicle.types.ts` | Facade a mano: `Vehicle`, `VehicleListResponse`, `CreateVehicleRequest`, `CreateVehicleResponse` |
| `tests/e2e/vehicles/vehicles.smoke.test.ts` | Smoke `@critical`: crear + listar + eliminar vehículo contra la API real |

### Modificar
| Archivo | Cambio |
|---|---|
| `tests/components/ApiFixture.ts` | Registrar `VehicleApi`; quitar `AuthApi` + `ExampleApi` |
| `tests/components/TestFixture.ts` | Quitar wiring de auth y `Example*` |
| `tests/components/UiFixture.ts` | Quitar `LoginPage` + `ExamplePage` (sin UI por ahora) |
| `config/variables.ts` | §4 |
| `config/validateTestEnv.ts` | Sin requerimiento de credenciales |
| `playwright.config.ts` | Quitar `ui-setup`/`api-setup`, storageState, `module-example` testIgnore, deps de auth en smoke |
| `tests/data/DataFactory.ts` | Quitar `createHotel`/`createBooking`; añadir `createVehicle` |
| `tests/data/types.ts` | Quitar `TestHotel`/`TestBooking`; añadir `TestVehicle`; quitar `ApiState` (sin token) |
| `allurerc.mjs` | `name: 'Route Optimizer QA'` |
| `dbhub.toml` | `type = "sqlite"`, `database = "../route-optimizer/backend/db.sqlite3"`, quitar `sslmode` para sqlite |
| `.mcp.json` + `opencode.jsonc` | `openapi` → `disabled`/eliminado en ambos |
| `kata-manifest.json` | Regenerar (`bun run kata:manifest`) |

### Eliminar
```
tests/components/api/AuthApi.ts
tests/components/api/ExampleApi.ts
tests/components/ui/LoginPage.ts
tests/components/ui/ExamplePage.ts
tests/components/steps/ExampleSteps.ts
api/schemas/auth.types.ts
api/schemas/example.types.ts
tests/setup/api-auth.setup.ts
tests/setup/ui-auth.setup.ts
tests/e2e/module-example/
tests/integration/module-example/
tests/e2e/dashboard/dashboard.test.ts        (UPEX-200, endpoint /auth/me inexistente)
tests/integration/auth/user-session.test.ts  (UPEX-100, idem)
tests/data/fixtures/example.json
.auth/ (si existe)
```

## 6. Env Vars + Secrets

- No se requieren GitHub Secrets de credenciales (sin auth). Se mantienen `TAVILY_API_KEY`, `POSTMAN_API_KEY`, `RESEND_API_KEY` como opcionales según uso.
- `DBHUB_*` para el MCP local (sqlite).
- `API_BASE_URL` para el curl del agente.
- Sin Xray/Jira/Atlassian (TMS sin configurar, `AUTO_SYNC=false`).

## 7. CI + MCP + Reporting

- **Workflows** (`build/smoke/sanity/regression.yml`): `environment.options: [local]`; quitar secrets `*_USER_EMAIL/_PASSWORD`; filtro smoke = `@critical`. Emitir bloque "Secrets que faltan por poner" (probablemente ninguno).
- **MCP dual-file**: `openapi` deshabilitado en ambos. `dbhub` activo (sqlite). `notion`, `context7`, `tavily`, `playwright`, `postman` sin cambios.
- **dbhub.toml**: source `primary` → sqlite.
- **allurerc.mjs**: `name: 'Route Optimizer QA'`.

## 8. Implementation Phases

| Fase | Acciones | Verify |
|---|---|---|
| 3 — Identity+variables | project.yaml, .env, variables.ts, validateTestEnv.ts | `bun run vars:check` · `vars:env:check` · `test:env:check` |
| 4 — Facades | vehicle.types.ts + index.ts (a mano, sin `@openapi`) | `bun run types:check` |
| 5 — (saltada: sin auth) | — | — |
| 6 — Primera entidad | VehicleApi, fixtures, borrar examples, smoke @critical | `bun run test:smoke` (target levantado) |
| 7 — CI+MCP+manifest | workflows, .mcp.json/opencode.jsonc, dbhub.toml, allurerc, kata-manifest | `bun run kata:manifest:check` |
| 8 — Validación | gate fail-fast ajustado (sin pasos de auth) | `types:check` → `lint:check` → `vars:check` → `vars:env:check` → `kata:manifest:check` → `test:smoke` → `repo:check` |
| 9 — Cierre | scan genericness, CLAUDE.md, marcado COMPLETED | tabla GENERIC/ADAPTED |

## 9. AI Guidelines

- Componentes importan de `@schemas/*`, nunca de `@openapi` (aquí ni siquiera existe).
- ATC = mini-flujo atómico, máx. 2 params posicionales, locators inline.
- Imports con alias (`@api/`, `@schemas/`, `@utils/`), sin relativos.
- Smoke tag = `@critical`, nunca `@smoke`.
- No hardcodear credenciales (no hay).
- Proyecto sin auth → los ATCs de Vehicle no requieren header de auth.

## 10. Questions Answered

1. **Auth**: NONE — eliminar capa de auth completa. (usuario 2026-08-10)
2. **project_key**: `ROUTE` provisional. (usuario 2026-08-10)
3. **Primera entidad**: Vehicle (CRUD simple, FEAT-001). (usuario 2026-08-10)
4. **OpenAPI**: facades a mano + MCP `openapi` deshabilitado. (usuario 2026-08-10)
5. **DB MCP**: sí, DBHub sqlite local. (usuario 2026-08-10)

## 11. Discovery Gaps

- **Sin OpenAPI publicado** — facades a mano; `drf-spectacular` en el target habilitaría `api:sync`.
- **Sin auth** — API pública; todo endpoint es ejecutable por cualquiera. Riesgo ya registrado en assessment (Phase 1).
- **Staging sin deploy** — URLs null; smoke solo en `local` hasta que exista host.
- **`ApiState` / `.auth/`** — se eliminan (no hay token); si mañana se añade auth, hay que reintroducir la capa.
- **project_key provisional** `ROUTE` — migrar a slug de Notion cuando se comparta la DB del tracker.
- **`@openapi` alias** — muerto tras deshabilitar el MCP; se retira del consumo (no romper tsconfig).

## 12. Genericness Baseline

| Subsystem | Pre-scan |
|---|---|
| project.yaml | GENERIC |
| ATC keys | GENERIC (PROJ-101/102/103) |
| Example components | GENERIC |
| Example specs | GENERIC |
| OpenAPI types | GENERIC (no existe api/schemas/) |
| Auth URLs | GENERIC (dojo.upexgalaxy.com, localhost:3000) |
| Auth layer | GENERIC (a eliminar) |
| CI workflows | GENERIC |
| DBHub / Allure / MCP | GENERIC |

## 13. Approval Checklist — EJECUTADO (2026-08-10)

- [x] Eliminar capa de auth completa (AuthApi, LoginPage, setups, storageState, config.auth)
- [x] ATC keys → `ROUTE-NNN`
- [x] Vehicle como primera entidad (VehicleApi + fixtures + smoke @critical)
- [x] Facades a mano (sin OpenAPI) + MCP `openapi` deshabilitado en .mcp.json y opencode.jsonc
- [x] DBHub sqlite local cableado
- [x] Workflows CI reconciliados (env local, sin secrets de credenciales, smoke @critical)
- [x] allurerc.mjs renombrado a "Route Optimizer QA"
- [x] Borrar todos los artifacts de ejemplo (Example*, module-example, dashboard, user-session, example.json)
- [x] Gate de validación: types → lint → vars → kata-manifest → smoke → repo:check

## 14. Fase 9 — Cierre (2026-08-10)

### Tabla GENERIC/ADAPTED (post-scan)

| Subsystem | Pre-scan (baseline) | Post-adaptación |
|---|---|---|
| project.yaml | GENERIC | ADAPTED — project_key `ROUTE`, default_env `local`, db_mcp `dbhub`; envs sin deploy con URLs null |
| ATC keys | GENERIC (PROJ-101/102/103) | ADAPTED — `ROUTE-201..204` (VehicleApi) |
| Example components | GENERIC | ADAPTED — `VehicleApi`; Example* eliminados |
| Example specs | GENERIC | ADAPTED — `vehicles.smoke.test.ts`; module-example/dashboard/user-session eliminados |
| OpenAPI types | GENERIC (sin api/schemas/) | ADAPTED — `vehicle.types.ts` a mano; stub `openapi-types.ts` conservado |
| Auth URLs | GENERIC (dojo.upexgalaxy.com, localhost:3000) | ADAPTED — solo `local` 127.0.0.1:5173/8000 |
| Auth layer | GENERIC (a eliminar) | ADAPTED — eliminada (AuthApi, LoginPage, setups, storageState, config.auth, ApiState, api-login) |
| CI workflows | GENERIC | ADAPTED — env `local`, sin secrets de credenciales, smoke `@critical` |
| DBHub / Allure / MCP | GENERIC | ADAPTED — dbhub sqlite local, allurerc "Route Optimizer QA", MCP `openapi` disabled |
| Machinery del framework (CLAUDE.md, skills, docs/, cli/, .template, .context templates) | — | GENERIC **por diseño** (regla 14: machinery portable se queda en inglés/genérico) |

### Señales residuales (documentadas, sin acción)

- **`staging` en el union `Environment`** — placeholder type-only (decisión aprobada Fase 3 §4: el union se mantiene `'local' | 'staging'`); hereda URLs de `local`; se retira cuando exista host o por decisión explícita.
- **`@openapi` alias** — muerto tras deshabilitar el MCP; tsconfig queda intacto (no romper tooling).
- **project_key `ROUTE`** — provisional; migrar a slug de Notion cuando se comparta la DB del tracker.
- **`ARTIFACT_LANGUAGE` sin uso** en vars:check — advertencia benigna del lint de vars.

### Follow-up post-cierre (2026-08-10)

- **`envDataMap.staging` → placeholder**: reemplazadas las URLs `dojo.upexgalaxy.com` por URLs de `local` (`config/variables.ts:96-100`). El proyecto solo corre en `local`; cero refs `dojo/upexgalaxy/UPEX` en la superficie del proyecto (config, tests, api, .context/PBI).
- **`.context/PBI/auth/` eliminado**: folder muerto del módulo auth (specs AUTH-T01, ATCs UPEX-101/105, refs "UPEX Dojo API") — residuo de ejemplo del módulo eliminado en Fase 6.
- **Machinery conserva `UPEX-`/`upex-galaxy` por diseño** (regla 14): `.claude/skills/`, `docs/`, `README.md`, `INSTALLER.md`, `cli/`, `scripts/`, `package.json` — ejemplos ilustrativos + repo upstream del boilerplate; se quedan para mantener portabilidad/updates.

### Gate final Fase 8 verificado (2026-08-10, target levantado)

`format:check` ✓ · `lint:check` ✓ · `types:check` ✓ · `vars:check` (0 errores) ✓ · `skills:check` (14/14) ✓ · `skills:registry:check` ✓ · `vars:env:check` ✓ · `kata:manifest:check` ✓ · `test:env:check` ✓ · `repo:check` ✓ · smoke `@critical` (ROUTE-200, ATCs 201/202/204 contra API real 127.0.0.1:8000) ✓

---

> **COMPLETADO.** Framework adaptado a Delivery Route Planner: sin auth, sin OpenAPI (facades a mano), sqlite local, Vehicle como primera entidad, smoke `@critical` verde. Fases 3-9 ejecutadas y validadas el 2026-08-10.

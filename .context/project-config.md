# Project Configuration

> Project: route-optimizer (Delivery Route Planner)
> Generated: 2026-08-08

## Repositories

| Repository | URL | Branch | Purpose |
|------------|-----|--------|---------|
| route-optimizer (monorepo) | local: `C:\laragon\www\route-optimizer` | main | Delivery route planning platform (last-mile) |
| backend | `../route-optimizer/backend` | main | Django REST API (vehicles, visits, routing) |
| frontend | `../route-optimizer/frontend` | main | React + Vite web app consuming the API |

> Note: no git remote discovered at discovery time; both packages live in the same monorepo.

## Tech Stack

### Frontend
- Framework: React 19.2.8 + Vite 8.2.0
- Language: TypeScript ~6.0.2
- Mapping: Leaflet 1.9.4 + react-leaflet 5.0.0 (OpenStreetMap, no API key)
- State: local component state + React context (no external store; verify in Phase 3)
- Styling: CSS (verify exact mechanism in Phase 3)

### Backend
- Framework: Django 5.2 LTS + Django REST Framework 3.16
- Language: Python 3.13
- ORM: Django ORM (built-in), SQLite dev database
- Apps: `vehicles`, `visits`, `routing`
- Optimizer: `routing.services.optimize_all` (deterministic heuristic; OR-Tools available as dependency)

### Database
- Type: SQLite (dev: `backend/db.sqlite3`; el e2e usaba `db.e2e.sqlite3`, eliminado 2026-08-08 — el E2E corre desde `agentic-qa-simpliroute`)
- Provider: local file (interchangeable with Postgres per `.context/product.md`)
- Access: direct file / DBHub MCP not configured yet (`db_mcp: null`)

### Infrastructure
- Cloud: none deployed at discovery time (local dev only)
- CI/CD: `.github/workflows/qa.yml` (present — assess in Phase 3)
- Monitoring: none discovered

## Environments

| Environment | URL | Purpose | Access |
|-------------|-----|---------|--------|
| Local (web) | http://127.0.0.1:5173 | Dev — React frontend | Direct |
| Local (api) | http://127.0.0.1:8000 | Dev — Django REST API | Direct (AllowAny, no auth) |
| qa | — | not configured (`web_url: null`) | — |
| staging | — | not configured | — |
| production | — | not configured | — |

## Tools and Access

- Issue tracker: **none** — `issue_tracker: null` (user has no Jira; route-optimizer is an example project with no stories)
- Project key: none
- Database: direct SQLite file; DBHub MCP pending
- Docs: target repo `.context/` + `docs/test-plan.md` (in-repo markdown)

## Access Checklist

- [x] Repository read access (local monorepo)
- [ ] Database access (MCP or direct) — direct SQLite file only; DBHub MCP not configured
- [ ] Issue tracker access — **blocker**: no tracker configured
- [x] Staging environment reachable — n/a (no staging deployed)
- [x] CI/CD visibility — `.github/workflows/qa.yml` in repo

## Discovery Gaps

- [ ] Issue tracker: none exists. route-optimizer is an example project with no Jira/Notion stories. Phase 4 backlog mapping deferred; templates only.
- [ ] Staging/production URLs: no deployed environments found. Confirm whether a deployed instance exists.
- [ ] Team contacts: none provided.
- [ ] DBHub / OpenAPI MCP access: not configured (sqlite direct + no OpenAPI spec published).
- [ ] Repository remote URL: no git remote detected in the monorepo at discovery time.

# EPIC-ROUTE-100: Gestión de Vehículos

> **Estado**: SIMULADO — no hay issue tracker (`project_key: null`). Este epic es un **simulacro local** para ejercitar el flujo agentic (`/sprint-testing` → `/test-automation`) sobre la SPA real. NO es un cache de sync (`[SYNC]`); no debe confundirse con datos de Jira/Notion.

## Descripción

Como despachador, quiero gestionar los vehículos de la flota (crear, listar, eliminar) para que estén disponibles en el planificador de rutas.

## Historias

- `stories/STORY-ROUTE-300-create-vehicle-ui/` — ROUTE-300: crear un vehículo desde la interfaz web.

## Notas

- El target es una SPA sin auth (`AllowAny`), sin routing (tabs). Los selectores UI son `data-testid` añadidos al target el 2026-08-10.
- ATCs UI asociados: `ROUTE-301` (navigate), `ROUTE-302` (create+verify), `ROUTE-303` (delete) — ver `tests/components/ui/VehiclePage.ts`.
- Cuando exista tracker, este epic/historias se regeneran desde el source of truth (Jira/Notion) vía `bun run jira:sync-issues` / `notion:sync-issues`.

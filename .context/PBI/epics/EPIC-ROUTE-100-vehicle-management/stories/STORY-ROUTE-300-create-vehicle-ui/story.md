# STORY-ROUTE-300: Crear un vehículo desde la interfaz web

> **Estado**: SIMULADO — no hay issue tracker (`project_key: null`). Historia simulada local para ejercitar el flujo agentic sobre la SPA real. NO es un cache de sync (`[SYNC]`).

## Título

Como despachador quiero crear un vehículo desde la interfaz web para que quede disponible en el planificador de rutas.

## Criterios de Aceptación

- **AC1 — Navegar al módulo de vehículos**: Given que abro la SPA When activo la pestaña "Vehículos" Then veo el formulario de creación y el listado.
- **AC2 — Crear un vehículo válido**: Given el formulario de vehículos When completo todos los campos obligatorios con datos válidos y guardo Then el sistema crea el vehículo (201) y aparece en el listado.
- **AC3 — Eliminar un vehículo**: Given un vehículo existente en el listado When lo elimino Then desaparece de la interfaz.

## Notas técnicas

- [x] API: `POST /api/vehicles/` (201) · `DELETE /api/vehicles/{id}/` (204)
- [ ] DB: sin migraciones (target)
- [x] UI: `VehicleForm.tsx`, `VehicleList.tsx`, tabs en `App.tsx` — `data-testid` añadidos el 2026-08-10
- [ ] Dependencias: EPIC-ROUTE-100

## Fuera de alcance

- Edición de vehículos (PUT/PATCH).
- Auth (sin auth en el target).

## Relacionadas

- Pertenece a: EPIC-ROUTE-100

# ROUTE-300 — Criterios de Aceptación

> Historia simulada (sin tracker) — detalle operativo de los ACs para la automatización.

| AC | Descripción | ATCs UI | Spec |
|----|-------------|---------|------|
| AC1 | Navegar a pestaña Vehículos desde la SPA | ROUTE-301 | `tests/e2e/vehicles/vehicles.ui.test.ts` |
| AC2 | Crear vehículo válido y ver en listado | ROUTE-302 | ídem |
| AC3 | Eliminar vehículo desde el listado | ROUTE-303 | ídem |

## Notas de testabilidad

- Selectores estables: `data-testid` (`tab-vehicles`, `vehicle-form`, `vehicle-*`, `vehicle-row-{id}`, `vehicle-delete-{id}`, `vehicle-search`, `vehicle-search-submit`).
- La búsqueda por nombre (`searchByName`) localiza la fila creada sin depender del orden del listado.
- Cleanup de seguridad vía API (`deleteVehicleSuccessfully`) en `finally` del spec.

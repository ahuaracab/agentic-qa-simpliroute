/**
 * KATA Architecture - Vehicle UI E2E Test (ROUTE-300)
 *
 * Navegador REAL (proyecto e2e, Desktop Chrome) contra la SPA de Route
 * Optimizer (127.0.0.1:5173) + API real (127.0.0.1:8000).
 *
 * Historia simulada ROUTE-300: "Como despachador quiero crear un vehículo
 * desde la interfaz web para que quede disponible en el planificador".
 * (Sin tracker: historia simulada local — ver .context/PBI/.../STORY-ROUTE-300.)
 *
 * ATCs usados: ROUTE-301 (navigate), ROUTE-302 (create+verify), ROUTE-303 (delete).
 * Selectores: data-testid añadidos al target (frontend/src).
 *
 * Requiere backend + frontend levantados (127.0.0.1:8000 y 127.0.0.1:5173).
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-300: Vehicle UI (navegador real)', () => {
  /**
   * @critical - Included in smoke tests
   *
   * ATCs: ROUTE-301, ROUTE-302, ROUTE-303
   */
  test('ROUTE-300: crear un vehículo desde la interfaz y eliminarlo', { tag: ['@critical'] }, async ({ ui, api }) => {
    // ARRANGE - datos dinámicos (DataFactory disponible vía ui.data)
    const vehicle = ui.data.createVehicle();

    // ACT & ASSERT - ATC UI de navegación (ROUTE-301)
    await ui.vehicle.navigateToVehiclesSuccessfully();

    // ACT & ASSERT - ATC UI de creación + verificación en listado (ROUTE-302)
    const createdId = await ui.vehicle.createVehicleSuccessfully(vehicle);

    try {
      // ACT & ASSERT - ATC UI de eliminación desde el listado (ROUTE-303)
      await ui.vehicle.deleteVehicleSuccessfully(vehicle.name);
    }
    finally {
      // Cleanup de seguridad: si la UI falló antes del delete, borra por API.
      // deleteVehicleByIdForCleanup es idempotente (tolera 404 si la UI ya borró).
      await api.vehicle.deleteVehicleByIdForCleanup(createdId);
    }
  });

  /**
   * Verificación de regresión del contrato UI: la fila creada aparece en el
   * listado con los valores clave (ROUTE-302 re-chequea, aquí validamos estado).
   */
  test('ROUTE-300: el formulario queda limpio tras crear', async ({ ui, api }) => {
    const vehicle = ui.data.createVehicle();

    await ui.vehicle.navigateToVehiclesSuccessfully();
    const createdId = await ui.vehicle.createVehicleSuccessfully(vehicle);

    try {
      const nameInput = ui.vehicle.page.getByTestId('vehicle-name');
      await expect(nameInput).toHaveValue('');
    }
    finally {
      await api.vehicle.deleteVehicleByIdForCleanup(createdId);
    }
  });
});

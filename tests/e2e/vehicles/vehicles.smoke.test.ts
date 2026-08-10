/**
 * KATA Architecture - Vehicles Smoke Test
 *
 * Smoke @critical contra la API real de Route Optimizer (AllowAny, sin auth).
 * Mini-flujo: crear vehículo -> verificar que aparece en el listado (search por
 * nombre) -> eliminar (cleanup).
 *
 * ATCs usados: ROUTE-202 (create), ROUTE-201 (list), ROUTE-204 (delete).
 * Requiere el backend levantado en http://127.0.0.1:8000.
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-200: Vehicles', () => {
  /**
   * @critical - Included in smoke tests
   *
   * ATCs: ROUTE-202, ROUTE-201, ROUTE-204
   */
  test('ROUTE-200: crear, listar y eliminar un vehículo', { tag: ['@critical'] }, async ({ api }) => {
    // ARRANGE - datos dinámicos (DataFactory disponible vía api.data)
    const vehicle = api.data.createVehicle();

    // ACT & ASSERT - ATC de creación (ROUTE-202)
    const [createResponse, created, sentPayload] = await api.vehicle.createVehicleSuccessfully(vehicle);

    // Test-level assertions
    expect(createResponse.ok()).toBe(true);
    expect(created.name).toBe(sentPayload.name);

    try {
      // ACT & ASSERT - ATC de listado con búsqueda por nombre (ROUTE-201)
      const [listResponse, listBody] = await api.vehicle.listVehiclesSuccessfully({
        params: { search: created.name },
      });

      // Test-level assertions
      expect(listResponse.ok()).toBe(true);
      const found = listBody.results.find(v => v.id === created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(created.name);
    }
    finally {
      // ACT & ASSERT - ATC de borrado (cleanup siempre, aunque falle el listado)
      await api.vehicle.deleteVehicleSuccessfully(created.id);
    }
  });
});

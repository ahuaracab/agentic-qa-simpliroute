/**
 * KATA Architecture - Vehicles integration: camino de error
 *
 * Cierra el gap del ATC ROUTE-203 (createVehicleWithInvalidData): estaba
 * definido en VehicleApi pero ningún spec lo orquestaba. Proyecto integration
 * (API-only, sin navegador) — corre bajo bun run test:integration / regression.
 *
 * ATC usado: ROUTE-203. Requiere el backend levantado en http://127.0.0.1:8000.
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-205: Vehicles error path', () => {
  /**
   * El API rechaza coordenadas fuera de rango: latitude/longitude validators
   * [-90,90] / [-180,180] (vehicles/models.py + DRF).
   */
  test('ROUTE-205: crear vehículo con datos inválidos es rechazado (400)', async ({ api }) => {
    // ARRANGE - payload válido pero con latitud/longitud fuera de rango
    const invalid = {
      ...api.data.createVehicle(),
      latitude: 200,
      longitude: 200,
    };

    // ACT & ASSERT - ATC de datos inválidos (ROUTE-203)
    const [response] = await api.vehicle.createVehicleWithInvalidData(invalid);

    // Test-level assertions
    expect(response.status()).toBe(400);
    expect(response.ok()).toBe(false);
  });
});

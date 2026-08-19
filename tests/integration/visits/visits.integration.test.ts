/**
 * KATA Architecture - Visits integration: error path y retrieve
 *
 * Cubre los ATCs ROUTE-213 (createVisitWithInvalidData) y ROUTE-214
 * (retrieveVisitSuccessfully), además de los happy paths ya cubiertos por el
 * smoke ROUTE-206. Proyecto integration (API-only, sin navegador).
 *
 * ATCs usados: ROUTE-211, ROUTE-213, ROUTE-214, ROUTE-216.
 * Requiere el backend levantado en http://127.0.0.1:8000.
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-207: Visits error path', () => {
  /**
   * El API rechaza coordenadas fuera de rango: latitude/longitude validators
   * [-90,90] / [-180,180] (visits/models.py + DRF).
   */
  test('ROUTE-207: crear visita con datos inválidos es rechazado (400)', async ({ api }) => {
    // ARRANGE - payload válido pero con coordenadas fuera de rango
    const invalid = {
      ...api.data.createVisit(),
      latitude: 200,
      longitude: 200,
    };

    // ACT & ASSERT - ATC de datos inválidos (ROUTE-213)
    const [response] = await api.visit.createVisitWithInvalidData(invalid);

    // Test-level assertions
    expect(response.status()).toBe(400);
    expect(response.ok()).toBe(false);
  });
});

test.describe('ROUTE-208: Visits retrieve', () => {
  /**
   * Recuperar una visita por id y verificar que los datos coinciden con el
   * payload creado (round-trip fiel con snake_case).
   */
  test('ROUTE-208: recuperar una visita creada por id', async ({ api }) => {
    // ARRANGE
    const visit = api.data.createVisit();

    // ACT - crear para luego recuperar (ROUTE-211)
    const [, created] = await api.visit.createVisitSuccessfully(visit);

    try {
      // ACT & ASSERT - ATC de retrieve (ROUTE-214)
      const [response, retrieved] = await api.visit.retrieveVisitSuccessfully(created.id);

      // Test-level assertions
      expect(response.status()).toBe(200);
      expect(retrieved.name).toBe(created.name);
      expect(retrieved.latitude).toBe(created.latitude);
      expect(retrieved.longitude).toBe(created.longitude);
    }
    finally {
      // Cleanup (ROUTE-216)
      await api.visit.deleteVisitSuccessfully(created.id);
    }
  });
});

/**
 * KATA Architecture - Visits Smoke Test
 *
 * Smoke @critical contra la API real de Route Optimizer (AllowAny, sin auth).
 * Mini-flujo: crear visita -> verificar que aparece en el listado (search por
 * nombre) -> actualizar -> eliminar (cleanup).
 *
 * ATCs usados: ROUTE-211 (create), ROUTE-212 (list), ROUTE-215 (update),
 * ROUTE-216 (delete). Requiere el backend levantado en http://127.0.0.1:8000.
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-206: Visits', () => {
  /**
   * @critical - Included in smoke tests
   *
   * ATCs: ROUTE-211, ROUTE-212, ROUTE-215, ROUTE-216
   */
  test('ROUTE-206: crear, buscar, actualizar y eliminar una visita', { tag: ['@critical'] }, async ({ api }) => {
    // ARRANGE - datos dinámicos (DataFactory)
    const visit = api.data.createVisit();

    // ACT & ASSERT - ATC de creación (ROUTE-211)
    const [createResponse, created, sentPayload] = await api.visit.createVisitSuccessfully(visit);

    // Test-level assertions
    expect(createResponse.ok()).toBe(true);
    expect(created.name).toBe(sentPayload.name);
    expect(created.latitude).toBe(sentPayload.latitude);

    try {
      // ACT & ASSERT - ATC de listado con búsqueda por nombre (ROUTE-212)
      const [listResponse, listBody] = await api.visit.listVisitsSuccessfully({ params: { search: created.name } });

      // Test-level assertions
      expect(listResponse.ok()).toBe(true);
      const found = listBody.results.find(v => v.id === created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(created.name);

      // ACT & ASSERT - ATC de actualización parcial (ROUTE-215)
      const [updateResponse, updated] = await api.visit.updateVisitSuccessfully(created.id, { address: 'Actualizada QA' });

      // Test-level assertions
      expect(updateResponse.ok()).toBe(true);
      expect(updated.address).toBe('Actualizada QA');
      expect(updated.id).toBe(created.id);
    }
    finally {
      // ACT & ASSERT - ATC de borrado (cleanup siempre, aunque falle lo anterior)
      await api.visit.deleteVisitSuccessfully(created.id);
    }
  });
});

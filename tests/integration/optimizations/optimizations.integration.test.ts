/**
 * KATA Architecture - Optimizations integration (CORE)
 *
 * Cubre el core del producto: crear un plan, confirmarlo, resolver paradas,
 * completarlo, cancelarlo (con liberación de recursos) y rechazar inputs
 * inválidos. Proyecto integration (API-only, sin navegador).
 *
 * ATCs usados: ROUTE-221..230. Requiere el backend levantado en
 * http://127.0.0.1:8000 (recomendado con ROUTING_OSRM=0 para determinismo).
 *
 * Cleanup: cada test elimina la optimización, el vehículo y la visita creados
 * (finally) para no dejar recursos ocupados en la DB sqlite local.
 */

import { expect, test } from '@TestFixture';

test.describe('ROUTE-220: Optimization lifecycle', () => {
  /**
   * Ciclo completo: crear (pending) -> recuperar -> confirmar (confirmed) ->
   * resolver parada (delivered) -> completar (completed).
   */
  test('ROUTE-220: crear, confirmar, resolver parada y completar una optimización', async ({ api }) => {
    // ARRANGE - recursos para el plan
    const vehicle = api.data.createVehicle();
    const visit = api.data.createVisit();
    const day = api.data.createOptimizationDate();

    const [, createdVehicle] = await api.vehicle.createVehicleSuccessfully(vehicle);
    const [, createdVisit] = await api.visit.createVisitSuccessfully(visit);

    let optimizationId: number | undefined;

    try {
      // ACT & ASSERT - ATC de creación (ROUTE-221)
      const [createResponse, optimization, sent] = await api.optimization.createOptimizationSuccessfully({
        date: day,
        vehicle_ids: [createdVehicle.id],
        visit_ids: [createdVisit.id],
      });

      // Test-level assertions
      expect(createResponse.ok()).toBe(true);
      expect(optimization.date).toBe(sent.date);
      expect(optimization.status).toBe('pending');
      expect(optimization.routes.length).toBeGreaterThan(0);
      expect(optimization.routes[0].stops.length).toBeGreaterThan(0);
      optimizationId = optimization.id;

      // ACT & ASSERT - ATC de retrieve (ROUTE-223)
      const [, retrieved] = await api.optimization.retrieveOptimizationSuccessfully(optimizationId);
      expect(retrieved.status).toBe('pending');

      // ACT & ASSERT - ATC de confirmar (ROUTE-224)
      const [, confirmed] = await api.optimization.confirmOptimizationSuccessfully(optimizationId);
      expect(confirmed.status).toBe('confirmed');

      // ACT & ASSERT - ATC de resolver parada (ROUTE-229)
      const firstStop = confirmed.routes[0].stops[0];
      expect(firstStop).toBeDefined();
      const [, delivered] = await api.optimization.resolveStopDeliveredSuccessfully(optimizationId, firstStop.id);
      const deliveredStop = delivered.routes.flatMap(route => route.stops).find(stop => stop.id === firstStop.id);
      expect(deliveredStop?.status).toBe('delivered');

      // ACT & ASSERT - ATC de completar (ROUTE-225)
      const [, completed] = await api.optimization.completeOptimizationSuccessfully(optimizationId);
      expect(completed.status).toBe('completed');
    }
    finally {
      // Cleanup: primero el plan (cascade), luego recursos
      if (optimizationId !== undefined) {
        await api.optimization.deleteOptimizationSuccessfully(optimizationId);
      }
      await api.vehicle.deleteVehicleSuccessfully(createdVehicle.id);
      await api.visit.deleteVisitSuccessfully(createdVisit.id);
    }
  });
});

test.describe('ROUTE-240: Optimization cancel', () => {
  /**
   * Cancelar una optimización pending libera los recursos del día: el vehículo
   * y la visita vuelven a aparecer en /available/resources/.
   */
  test('ROUTE-240: cancelar una optimización libera los recursos del día', async ({ api }) => {
    // ARRANGE
    const vehicle = api.data.createVehicle();
    const visit = api.data.createVisit();
    const day = api.data.createOptimizationDate();

    const [, createdVehicle] = await api.vehicle.createVehicleSuccessfully(vehicle);
    const [, createdVisit] = await api.visit.createVisitSuccessfully(visit);

    let optimizationId: number | undefined;

    try {
      // ACT - crear el plan (ROUTE-221)
      const [, optimization] = await api.optimization.createOptimizationSuccessfully({
        date: day,
        vehicle_ids: [createdVehicle.id],
        visit_ids: [createdVisit.id],
      });
      optimizationId = optimization.id;

      // ASSERT - mientras está pending, el vehículo NO está disponible
      const [, busy] = await api.optimization.getAvailableResourcesSuccessfully(day);
      const vehicleBusy = busy.vehicles.find(v => v.id === createdVehicle.id);
      expect(vehicleBusy).toBeUndefined();

      // ACT & ASSERT - ATC de cancelar (ROUTE-226)
      const [, cancelled] = await api.optimization.cancelOptimizationSuccessfully(optimizationId);
      expect(cancelled.status).toBe('cancelled');

      // ASSERT - tras cancelar, vehículo y visita vuelven a estar disponibles
      const [, available] = await api.optimization.getAvailableResourcesSuccessfully(day);
      const vehicleFree = available.vehicles.find(v => v.id === createdVehicle.id);
      const visitFree = available.visits.find(v => v.id === createdVisit.id);
      expect(vehicleFree).toBeDefined();
      expect(visitFree).toBeDefined();
    }
    finally {
      // Cleanup
      if (optimizationId !== undefined) {
        await api.optimization.deleteOptimizationSuccessfully(optimizationId);
      }
      await api.vehicle.deleteVehicleSuccessfully(createdVehicle.id);
      await api.visit.deleteVisitSuccessfully(createdVisit.id);
    }
  });
});

test.describe('ROUTE-250: Optimization error path', () => {
  /**
   * El API rechaza crear un plan con vehicle_ids inexistentes: este es el check
   * que corre PRIMERO en OptimizationViewSet.create (validación de dominio).
   */
  test('ROUTE-250: crear optimización con vehículo inexistente es rechazado (400)', async ({ api }) => {
    // ACT & ASSERT - ATC de error (ROUTE-227)
    const [response, body] = await api.optimization.createOptimizationWithUnknownVehicle({
      date: api.data.createOptimizationDate(),
      vehicle_ids: [99999999],
      visit_ids: [1],
    });

    // Test-level assertions
    expect(response.status()).toBe(400);
    expect(body.detail).toBeDefined();
  });
});

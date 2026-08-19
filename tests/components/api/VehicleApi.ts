/**
 * KATA Architecture - Layer 3: Vehicle API Component
 *
 * Route Optimizer - API REST pública (AllowAny, sin auth).
 * Base URL: config.apiUrl (local: http://127.0.0.1:8000/api).
 * Endpoints reales (DRF ModelViewSet + DefaultRouter):
 *   GET    /vehicles/          list (paginated, searchable by name)
 *   POST   /vehicles/          create (201)
 *   GET    /vehicles/{id}/     retrieve (200)
 *   DELETE /vehicles/{id}/     delete (204)
 *
 * KATA Principles Demonstrated:
 * - ATCs are COMPLETE test cases (mini-flows), NOT single API calls
 * - Each ATC has a UNIQUE expected output (Equivalence Partitioning)
 * - Tuple returns: [APIResponse, TBody, TPayload] for type-safe access
 * - Fixed assertions validate the ATC succeeded
 */

import type { RequestOptions } from '@api/ApiBase';
import type { APIResponse } from '@playwright/test';
import type { CreateVehicleRequest, CreateVehicleResponse, VehicleListResponse } from '@schemas/vehicle.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from VehicleApi
export type { CreateVehicleRequest, CreateVehicleResponse, Vehicle, VehicleListResponse } from '@schemas/vehicle.types';

// ============================================
// Vehicle API Component
// ============================================

export class VehicleApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: GET /vehicles/ - list vehicles (200)
   *
   * Complete flow: fetch paginated list, validate envelope structure.
   * Optional `search` param filters by name (DRF SearchFilter).
   *
   * @atc ROUTE-201
   */
  @atc('ROUTE-201')
  async listVehiclesSuccessfully(
    options: RequestOptions = {},
  ): Promise<[APIResponse, VehicleListResponse]> {
    const [response, body] = await this.apiGET<VehicleListResponse>('/vehicles/', options);

    // Fixed assertions - validates the list operation succeeded
    expect(response.status()).toBe(200);
    expect(body).toBeDefined();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(0);

    return [response, body];
  }

  /**
   * ATC: POST /vehicles/ with valid payload - expects success (201)
   *
   * Complete flow: create vehicle, validate response echoes the request.
   * Returns the response tuple for test assertions.
   *
   * @atc ROUTE-202
   */
  @atc('ROUTE-202')
  async createVehicleSuccessfully(
    payload: CreateVehicleRequest,
  ): Promise<[APIResponse, CreateVehicleResponse, CreateVehicleRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<CreateVehicleResponse, CreateVehicleRequest>(
      '/vehicles/',
      payload,
    );

    // Fixed assertions - validates the create operation succeeded
    expect(response.status()).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe(sentPayload.name);

    return [response, body, sentPayload];
  }

  /**
   * ATC: POST /vehicles/ with invalid payload - expects error (400)
   *
   * Validates that invalid data returns an appropriate error.
   *
   * @atc ROUTE-203
   */
  @atc('ROUTE-203')
  async createVehicleWithInvalidData(
    payload: CreateVehicleRequest,
  ): Promise<[APIResponse, Record<string, unknown>, CreateVehicleRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<
      Record<string, unknown>,
      CreateVehicleRequest
    >('/vehicles/', payload);

    // Fixed assertions - validates error response
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.ok()).toBe(false);

    return [response, body, sentPayload];
  }

  /**
   * ATC: DELETE /vehicles/{id}/ - delete a vehicle (204)
   *
   * Complete flow: delete by id, validate 204 No Content.
   *
   * @atc ROUTE-204
   */
  @atc('ROUTE-204')
  async deleteVehicleSuccessfully(vehicleId: number): Promise<[APIResponse, Record<string, unknown>]> {
    const [response, body] = await this.apiDELETE<Record<string, unknown>>(`/vehicles/${vehicleId}/`);

    // Fixed assertions - validates the delete operation succeeded
    expect(response.status()).toBe(204);

    return [response, body];
  }

  /**
   * Cleanup helper (sin @atc): DELETE idempotente para limpieza en `finally`.
   * Tolerante a 404 (el recurso ya pudo ser eliminado por la UI). No registra
   * resultado en el reporte ATC — el delete verificado es ROUTE-204.
   */
  async deleteVehicleByIdForCleanup(vehicleId: number): Promise<void> {
    await this.apiDELETE(`/vehicles/${vehicleId}/`);
  }
}

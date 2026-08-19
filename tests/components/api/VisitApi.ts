/**
 * KATA Architecture - Layer 3: Visit API Component
 *
 * Route Optimizer - API REST pública (AllowAny, sin auth).
 * Base URL: config.apiUrl (local: http://127.0.0.1:8000/api).
 * Endpoints reales (DRF ModelViewSet + DefaultRouter):
 *   GET    /visits/           list (paginated, searchable by name)
 *   POST   /visits/           create (201)
 *   GET    /visits/{id}/      retrieve (200)
 *   PATCH  /visits/{id}/      partial update (200)
 *   DELETE /visits/{id}/      delete (204)
 *
 * KATA Principles Demonstrated:
 * - ATCs are COMPLETE test cases (mini-flows), NOT single API calls
 * - Each ATC has a UNIQUE expected output (Equivalence Partitioning)
 * - Tuple returns: [APIResponse, TBody, TPayload] for type-safe access
 * - Fixed assertions validate the ATC succeeded
 */

import type { RequestOptions } from '@api/ApiBase';
import type { APIResponse } from '@playwright/test';
import type { CreateVisitRequest, CreateVisitResponse, Visit, VisitListResponse } from '@schemas/visit.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from VisitApi
export type { CreateVisitRequest, CreateVisitResponse, Visit, VisitListResponse } from '@schemas/visit.types';

// ============================================
// Visit API Component
// ============================================

export class VisitApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: POST /visits/ — alta de una visita válida (201)
   */
  @atc('ROUTE-211')
  async createVisitSuccessfully(
    payload: CreateVisitRequest,
  ): Promise<[APIResponse, CreateVisitResponse, CreateVisitRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<CreateVisitResponse, CreateVisitRequest>('/visits/', payload);
    expect(response.status()).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe(sentPayload.name);
    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /visits/ — listado paginado con búsqueda opcional por nombre (200)
   */
  @atc('ROUTE-212')
  async listVisitsSuccessfully(options: RequestOptions = {}): Promise<[APIResponse, VisitListResponse]> {
    const [response, body] = await this.apiGET<VisitListResponse>('/visits/', options);
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.results)).toBe(true);
    return [response, body];
  }

  /**
   * ATC: POST /visits/ con datos inválidos (400)
   */
  @atc('ROUTE-213')
  async createVisitWithInvalidData(
    payload: CreateVisitRequest,
  ): Promise<[APIResponse, Record<string, unknown>, CreateVisitRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<Record<string, unknown>, CreateVisitRequest>('/visits/', payload);
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.ok()).toBe(false);
    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /visits/{id}/ — recuperar una visita por id (200)
   */
  @atc('ROUTE-214')
  async retrieveVisitSuccessfully(visitId: number): Promise<[APIResponse, Visit]> {
    const [response, body] = await this.apiGET<Visit>(`/visits/${visitId}/`);
    expect(response.status()).toBe(200);
    expect(body.id).toBe(visitId);
    return [response, body];
  }

  /**
   * ATC: PATCH /visits/{id}/ — actualización parcial (200)
   */
  @atc('ROUTE-215')
  async updateVisitSuccessfully(
    visitId: number,
    payload: Partial<CreateVisitRequest>,
  ): Promise<[APIResponse, Visit, Partial<CreateVisitRequest>]> {
    const [response, body, sentPayload] = await this.apiPATCH<Visit, Partial<CreateVisitRequest>>(`/visits/${visitId}/`, payload);
    expect(response.status()).toBe(200);
    expect(body.id).toBe(visitId);
    return [response, body, sentPayload];
  }

  /**
   * ATC: DELETE /visits/{id}/ — eliminación (204)
   */
  @atc('ROUTE-216')
  async deleteVisitSuccessfully(visitId: number): Promise<[APIResponse, Record<string, unknown>]> {
    const [response, body] = await this.apiDELETE<Record<string, unknown>>(`/visits/${visitId}/`);
    expect(response.status()).toBe(204);
    return [response, body];
  }
}

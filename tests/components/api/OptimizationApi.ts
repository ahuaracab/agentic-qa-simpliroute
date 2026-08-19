/**
 * KATA Architecture - Layer 3: Optimization API Component (CORE)
 *
 * Route Optimizer - API REST pública (AllowAny, sin auth).
 * Base URL: config.apiUrl (local: http://127.0.0.1:8000/api).
 * Endpoints reales (routing/views.py + DefaultRouter):
 *   GET    /optimizations/                        list (paginated, newest first)
 *   POST   /optimizations/                        create (201) {date, vehicle_ids, visit_ids}
 *   GET    /optimizations/{id}/                   retrieve (200)
 *   DELETE /optimizations/{id}/                   delete (204, cascade routes/stops)
 *   POST   /optimizations/{id}/confirm/           pending → confirmed (200)
 *   POST   /optimizations/{id}/complete/          confirmed → completed (200)
 *   POST   /optimizations/{id}/cancel/            pending|confirmed → cancelled (200)
 *   POST   /optimizations/{id}/stops/{sid}/deliver/  confirmed only (200)
 *   GET    /available/resources/?date=YYYY-MM-DD  vehicles+visits disponibles (200)
 *
 * ATCs: ROUTE-221..230 (crear, listar, recuperar, confirmar, completar, cancelar,
 * error, recursos disponibles, resolver parada, eliminar).
 */

import type { RequestOptions } from '@api/ApiBase';
import type { APIResponse } from '@playwright/test';
import type {
  AvailableResourcesResponse,
  CreateOptimizationRequest,
  Optimization,
  OptimizationDetailResponse,
  OptimizationListResponse,
} from '@schemas/optimization.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from OptimizationApi
export type {
  AvailableResourcesResponse,
  CreateOptimizationRequest,
  Optimization,
  OptimizationDetailResponse,
  OptimizationListResponse,
} from '@schemas/optimization.types';

// ============================================
// Optimization API Component
// ============================================

export class OptimizationApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: POST /optimizations/ — crear plan para un día (201, status pending)
   */
  @atc('ROUTE-221')
  async createOptimizationSuccessfully(
    payload: CreateOptimizationRequest,
  ): Promise<[APIResponse, OptimizationDetailResponse, CreateOptimizationRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<OptimizationDetailResponse, CreateOptimizationRequest>(
      '/optimizations/',
      payload,
    );
    expect(response.status()).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
    expect(Array.isArray(body.routes)).toBe(true);
    expect(Array.isArray(body.unassigned_visits)).toBe(true);
    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /optimizations/ — listado paginado (200)
   */
  @atc('ROUTE-222')
  async listOptimizationsSuccessfully(options: RequestOptions = {}): Promise<[APIResponse, OptimizationListResponse]> {
    const [response, body] = await this.apiGET<OptimizationListResponse>('/optimizations/', options);
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.results)).toBe(true);
    return [response, body];
  }

  /**
   * ATC: GET /optimizations/{id}/ — recuperar por id (200)
   */
  @atc('ROUTE-223')
  async retrieveOptimizationSuccessfully(optimizationId: number): Promise<[APIResponse, Optimization]> {
    const [response, body] = await this.apiGET<Optimization>(`/optimizations/${optimizationId}/`);
    expect(response.status()).toBe(200);
    expect(body.id).toBe(optimizationId);
    return [response, body];
  }

  /**
   * ATC: POST /optimizations/{id}/confirm/ — pending → confirmed (200)
   */
  @atc('ROUTE-224')
  async confirmOptimizationSuccessfully(optimizationId: number): Promise<[APIResponse, Optimization]> {
    const [response, body] = await this.apiPOST<Optimization, Record<string, unknown>>(
      `/optimizations/${optimizationId}/confirm/`,
      {},
    );
    expect(response.status()).toBe(200);
    expect(body.status).toBe('confirmed');
    expect(body.confirmed_at).not.toBeNull();
    return [response, body];
  }

  /**
   * ATC: POST /optimizations/{id}/complete/ — confirmed → completed (200)
   */
  @atc('ROUTE-225')
  async completeOptimizationSuccessfully(optimizationId: number): Promise<[APIResponse, Optimization]> {
    const [response, body] = await this.apiPOST<Optimization, Record<string, unknown>>(
      `/optimizations/${optimizationId}/complete/`,
      {},
    );
    expect(response.status()).toBe(200);
    expect(body.status).toBe('completed');
    expect(body.completed_at).not.toBeNull();
    return [response, body];
  }

  /**
   * ATC: POST /optimizations/{id}/cancel/ — pending|confirmed → cancelled (200)
   */
  @atc('ROUTE-226')
  async cancelOptimizationSuccessfully(optimizationId: number): Promise<[APIResponse, Optimization]> {
    const [response, body] = await this.apiPOST<Optimization, Record<string, unknown>>(
      `/optimizations/${optimizationId}/cancel/`,
      {},
    );
    expect(response.status()).toBe(200);
    expect(body.status).toBe('cancelled');
    return [response, body];
  }

  /**
   * ATC: POST /optimizations/ con vehicle_ids inexistentes (400)
   */
  @atc('ROUTE-227')
  async createOptimizationWithUnknownVehicle(
    payload: CreateOptimizationRequest,
  ): Promise<[APIResponse, Record<string, unknown>, CreateOptimizationRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<Record<string, unknown>, CreateOptimizationRequest>(
      '/optimizations/',
      payload,
    );
    expect(response.status()).toBe(400);
    expect(body.detail).toBeDefined();
    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /available/resources/?date= — recursos disponibles del día (200)
   */
  @atc('ROUTE-228')
  async getAvailableResourcesSuccessfully(date: string): Promise<[APIResponse, AvailableResourcesResponse]> {
    const [response, body] = await this.apiGET<AvailableResourcesResponse>('/available/resources/', {
      params: { date },
    });
    expect(response.status()).toBe(200);
    expect(Array.isArray(body.vehicles)).toBe(true);
    expect(Array.isArray(body.visits)).toBe(true);
    return [response, body];
  }

  /**
   * ATC: POST /optimizations/{id}/stops/{sid}/deliver/ — resolver parada (200)
   */
  @atc('ROUTE-229')
  async resolveStopDeliveredSuccessfully(optimizationId: number, stopId: number): Promise<[APIResponse, Optimization]> {
    const [response, body] = await this.apiPOST<Optimization, Record<string, unknown>>(
      `/optimizations/${optimizationId}/stops/${stopId}/deliver/`,
      {},
    );
    expect(response.status()).toBe(200);
    const stop = body.routes.flatMap(route => route.stops).find(s => s.id === stopId);
    expect(stop).toBeDefined();
    expect(stop?.status).toBe('delivered');
    return [response, body];
  }

  /**
   * ATC: DELETE /optimizations/{id}/ — eliminar plan (204, libera recursos)
   */
  @atc('ROUTE-230')
  async deleteOptimizationSuccessfully(optimizationId: number): Promise<[APIResponse, Record<string, unknown>]> {
    const [response, body] = await this.apiDELETE<Record<string, unknown>>(`/optimizations/${optimizationId}/`);
    expect(response.status()).toBe(204);
    return [response, body];
  }
}

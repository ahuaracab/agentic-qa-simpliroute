/**
 * KATA Framework - Type Facade: Optimization Domain (CORE)
 *
 * HAND-WRITTEN facade — the target publishes no OpenAPI spec, so this file
 * mirrors the real contract from route-optimizer/backend (routing/serializers.py,
 * routing/views.py). El core del producto: tomar un día, asignar visitas a
 * vehículos, ejecutar el plan (confirmar, completar, cancelar, resolver paradas)
 * y liberar recursos.
 *
 * Endpoints (DefaultRouter, prefix /api/):
 *   GET    /api/optimizations/                             list (paginated, newest first)
 *   POST   /api/optimizations/                             create (201) {date, vehicle_ids, visit_ids}
 *   GET    /api/optimizations/{id}/                        retrieve (200)
 *   DELETE /api/optimizations/{id}/                        delete (204, cascade routes/stops)
 *   POST   /api/optimizations/{id}/confirm/                pending → confirmed (200)
 *   POST   /api/optimizations/{id}/complete/               confirmed → completed (200)
 *   POST   /api/optimizations/{id}/cancel/                 pending|confirmed → cancelled (200)
 *   POST   /api/optimizations/{id}/stops/{sid}/deliver/    confirmed only → stop delivered (200)
 *   GET    /api/available/resources/?date=YYYY-MM-DD       vehicles+visits disponibles (200)
 *
 * Estado (Optimization.Status): pending → confirmed → completed | cancelled
 * Parada (RouteStop.Status): pending → delivered | failed
 *
 * OSRM: con ROUTING_OSRM=1 se usa OR-Tools+OSRM; si la red falla degrada a
 * heurística determinista (services.optimize_all). Los tests usan ROUTING_OSRM=0
 * para determinismo (igual que el conftest del propio target).
 */

import type { Vehicle } from './vehicle.types';
import type { Visit } from './visit.types';

// ============================================================================
// Schema Types
// ============================================================================

export type OptimizationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type RouteStopStatus = 'pending' | 'delivered' | 'failed';

/** Parada de una ruta — mirrors RouteStopSerializer */
export interface RouteStop {
  id: number
  sequence: number
  visit: Visit
  arrival_minutes: number
  departure_minutes: number
  status: RouteStopStatus
  resolved_at: string | null
}

/** Ruta de un vehículo dentro de una optimización — mirrors OptimizationRouteSerializer */
export interface OptimizationRoute {
  id: number
  vehicle_id: number
  vehicle_name: string
  vehicle_latitude: number
  vehicle_longitude: number
  start_minutes: number
  end_minutes: number
  total_distance_km: number
  total_duration_minutes: number
  geometry: unknown | null
  stops: RouteStop[]
}

/** Optimización planificada — mirrors OptimizationSerializer */
export interface Optimization {
  id: number
  date: string
  status: OptimizationStatus
  created_at: string
  confirmed_at: string | null
  completed_at: string | null
  routes: OptimizationRoute[]
}

/** Body del create (201): optimización + visitas no asignadas */
export interface OptimizationDetailResponse extends Optimization {
  unassigned_visits: Visit[]
}

/** Envelope paginated del listado */
export interface OptimizationListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Optimization[]
}

/** Request body para crear una optimización */
export interface CreateOptimizationRequest {
  date: string
  vehicle_ids: number[]
  visit_ids: number[]
}

/** Respuesta de GET /api/available/resources/ */
export interface AvailableResourcesResponse {
  vehicles: Vehicle[]
  visits: Visit[]
}

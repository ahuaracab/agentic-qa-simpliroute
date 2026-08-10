/**
 * KATA Framework - Type Facade: Vehicle Domain
 *
 * HAND-WRITTEN facade — the target publishes no OpenAPI spec (drf-spectacular
 * not installed), so `@openapi` is a dead alias and this file mirrors the real
 * contract directly from route-optimizer/backend (vehicles/serializers.py):
 *   id, name, capacity_kg, capacity_l, average_speed_kmh, latitude, longitude,
 *   work_start, work_end, lunch_start, lunch_end, created_at
 *
 * Endpoints (DRF ModelViewSet + DefaultRouter, prefix /api/):
 *   GET /api/vehicles/            list (paginated, searchable by name)
 *   POST /api/vehicles/           create (201)
 *   GET /api/vehicles/{id}/       retrieve (200)
 *   DELETE /api/vehicles/{id}/    delete (204)
 *
 * Pagination: config.pagination.StandardResultsSetPagination (page_size=10)
 *   list response envelope = { count, next, previous, results }
 *
 * Field notes:
 *   - capacity_kg / capacity_l / average_speed_kmh are FloatFields with
 *     defaults (1000 / 1000 / 40) — optional on create.
 *   - work_* / lunch_* are TimeField — serialized as "HH:MM:SS".
 *   - id + created_at are read-only (not writable on create).
 */

// ============================================================================
// Schema Types
// ============================================================================

/** Repartidor (delivery courier) — mirrors VehicleSerializer fields */
export interface Vehicle {
  id: number
  name: string
  capacity_kg: number
  capacity_l: number
  average_speed_kmh: number
  latitude: number
  longitude: number
  work_start: string
  work_end: string
  lunch_start: string
  lunch_end: string
  created_at: string
}

// ============================================================================
// Endpoint Types - GET /api/vehicles/
// ============================================================================

/** Paginated envelope returned by the list endpoint (PageNumberPagination) */
export interface VehicleListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Vehicle[]
}

// ============================================================================
// Endpoint Types - POST /api/vehicles/
// ============================================================================

/** Request body for creating a vehicle (required: name, latitude, longitude) */
export interface CreateVehicleRequest {
  name: string
  capacity_kg?: number
  capacity_l?: number
  average_speed_kmh?: number
  latitude: number
  longitude: number
  work_start?: string
  work_end?: string
  lunch_start?: string
  lunch_end?: string
}

/** Successful response (201) — the created Vehicle */
export type CreateVehicleResponse = Vehicle;

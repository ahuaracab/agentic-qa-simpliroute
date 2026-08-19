/**
 * KATA Framework - Type Facade: Visit Domain
 *
 * HAND-WRITTEN facade — the target publishes no OpenAPI spec (drf-spectacular
 * not installed), so this file mirrors the real contract directly from
 * route-optimizer/backend (visits/serializers.py):
 *   id, name, address, latitude, longitude, service_time_minutes, priority,
 *   weight_kg, volume_l, time_window_start, time_window_end, created_at
 *
 * Endpoints (DRF ModelViewSet + DefaultRouter, prefix /api/):
 *   GET    /api/visits/            list (paginated, searchable by name)
 *   POST   /api/visits/            create (201)
 *   GET    /api/visits/{id}/       retrieve (200)
 *   PATCH  /api/visits/{id}/       partial update (200)
 *   DELETE /api/visits/{id}/       delete (204)
 *   POST   /api/visits/import/     bulk import (200) — NOT covered yet
 *
 * Field notes:
 *   - name + latitude + longitude required; latitude ∈ [-90,90], longitude ∈ [-180,180]
 *   - service_time_minutes / priority are PositiveInteger min 1
 *   - weight_kg / volume_l Float min 0 (default 0.0)
 *   - time_window_* are TimeField nullable — "HH:MM:SS" or null
 */

// ============================================================================
// Schema Types
// ============================================================================

/** Destino de entrega — mirrors VisitSerializer fields */
export interface Visit {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  service_time_minutes: number
  priority: number
  weight_kg: number
  volume_l: number
  time_window_start: string | null
  time_window_end: string | null
  created_at: string
}

/** Envelope paginated devuelto por el listado */
export interface VisitListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Visit[]
}

/** Request body para crear una visita (obligatorios: name, latitude, longitude) */
export interface CreateVisitRequest {
  name: string
  address?: string
  latitude: number
  longitude: number
  service_time_minutes?: number
  priority?: number
  weight_kg?: number
  volume_l?: number
  time_window_start?: string | null
  time_window_end?: string | null
}

/** Request body para actualizar parcialmente (PATCH) */
export type UpdateVisitRequest = Partial<CreateVisitRequest>;

/** Respuesta del create (201): la visita creada */
export type CreateVisitResponse = Visit;

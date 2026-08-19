/**
 * KATA Architecture - Test Data Types
 *
 * Types for test data generation and fixture state.
 * These are TEST-ONLY concepts — NOT API contract types.
 *
 * API contract types (request/response schemas) belong in:
 *   api/schemas/{domain}.types.ts → import from '@schemas/{domain}.types'
 */

// ============================================
// Generic Types
// ============================================

export interface TestUser {
  email: string
  password: string
  name: string
  firstName?: string
  lastName?: string
}

export interface TestCredentials {
  email: string
  password: string
}

// ============================================
// Project-Specific Types (Route Optimizer)
// ============================================

/**
 * Datos de prueba de un vehículo.
 * Nombres snake_case: el API público del target (DRF) ignora campos camelCase,
 * así que el factory genera EL MISMO shape que CreateVehicleRequest.
 */
export interface TestVehicle {
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
}

/** Datos de prueba de una visita de entrega (mismo shape que CreateVisitRequest). */
export interface TestVisit {
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
}

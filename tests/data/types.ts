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

export interface TestVehicle {
  name: string
  capacityKg: number
  capacityL: number
  averageSpeedKmh: number
  latitude: number
  longitude: number
  workStart: string
  workEnd: string
  lunchStart: string
  lunchEnd: string
}

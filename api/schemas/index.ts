/**
 * KATA Framework - OpenAPI Type Facades (Barrel Export)
 *
 * Re-exports all domain type facades for cross-domain imports.
 * Prefer importing from specific domain files: import type { X } from '@schemas/vehicle.types'
 * Use this barrel only when you need types from multiple domains in one file.
 *
 * Usage:
 *   import type { Vehicle, CreateVehicleRequest } from '@schemas/vehicle.types';  // preferred
 *   import type { CreateVehicleRequest } from '@schemas';                         // cross-domain
 */

export type * from './vehicle.types';

// Add new domain facades here:
// export type * from './visits.types';

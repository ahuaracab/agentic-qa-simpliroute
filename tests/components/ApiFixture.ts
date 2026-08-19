/**
 * KATA Architecture - Layer 4: API Fixture
 *
 * Dependency Injection container for all API components.
 * Provides unified access to API testing capabilities.
 *
 * All API components share the same request context from TestContext,
 * ensuring consistent authentication and request configuration.
 *
 * HOW TO ADD NEW API COMPONENTS:
 * 1. Create your component in tests/components/api/YourApi.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { OptimizationApi } from '@api/OptimizationApi';
import { VehicleApi } from '@api/VehicleApi';
import { VisitApi } from '@api/VisitApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Vehicle component - CRUD against the public /vehicles/ API */
  readonly vehicle: VehicleApi;

  /** Visit component - CRUD against the public /visits/ API */
  readonly visit: VisitApi;

  /** Optimization component - CORE: planes, transiciones de estado y recursos */
  readonly optimization: OptimizationApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.vehicle = new VehicleApi(options);
    this.visit = new VisitApi(options);
    this.optimization = new OptimizationApi(options);
  }
}

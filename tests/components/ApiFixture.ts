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
import { VehicleApi } from '@api/VehicleApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Vehicle component - CRUD against the public /vehicles/ API */
  readonly vehicle: VehicleApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.vehicle = new VehicleApi(options);
  }
}

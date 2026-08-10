/**
 * KATA Architecture - Data Factory
 *
 * Generador centralizado de datos de prueba.
 * Regla de oro: NUNCA datos estáticos, siempre dinámicos con Faker.
 *
 * Acceso:
 *   - Desde componentes: this.data.createUser()
 *   - Import directo: import { DataFactory } from '@DataFactory'
 */

import type { TestCredentials, TestUser, TestVehicle } from './types';

import { faker } from '@faker-js/faker';

export class DataFactory {
  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  private static uniqueId(): string {
    return `${Date.now()}-${faker.string.alphanumeric(6)}`;
  }

  private static testEmail(prefix = 'test'): string {
    const id = faker.string.alphanumeric(6).toLowerCase();
    const name = faker.person.firstName().toLowerCase();
    return `${prefix}.${name}.${id}@example.com`;
  }

  private static securePassword(): string {
    return `Test${faker.string.alphanumeric(8)}!`;
  }

  // ============================================
  // GENERADORES PRINCIPALES
  // ============================================

  /**
   * Genera un usuario completo para testing
   * @param overrides - Propiedades a sobreescribir
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      email: this.testEmail(),
      password: this.securePassword(),
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      ...overrides,
    };
  }

  /**
   * Genera solo credenciales (email + password)
   * @param overrides - Propiedades a sobreescribir
   */
  static createCredentials(overrides?: Partial<TestCredentials>): TestCredentials {
    return {
      email: this.testEmail(),
      password: this.securePassword(),
      ...overrides,
    };
  }

  /**
   * Genera un ID único para identificar datos de test
   * Útil para cleanup y trazabilidad
   */
  static createTestId(prefix = 'test'): string {
    return `${prefix}-${this.uniqueId()}`;
  }

  // ============================================
  // PROJECT-SPECIFIC (Route Optimizer)
  // ============================================

  /**
   * Genera un vehículo válido para testing
   * Contrato real: vehicle.types.ts (VehicleSerializer)
   * Requeridos en el request: name, latitude, longitude
   * @param overrides - Propiedades a sobreescribir
   */
  static createVehicle(overrides?: Partial<TestVehicle>): TestVehicle {
    return {
      name: `Vehículo ${faker.location.city()} ${this.uniqueId()}`,
      capacityKg: faker.number.float({ min: 500, max: 2000, fractionDigits: 2 }),
      capacityL: faker.number.float({ min: 500, max: 2000, fractionDigits: 2 }),
      averageSpeedKmh: faker.number.float({ min: 20, max: 90, fractionDigits: 1 }),
      latitude: faker.location.latitude({ max: -33.5, min: -33.6, precision: 5 }),
      longitude: faker.location.longitude({ max: -70.65, min: -70.7, precision: 5 }),
      workStart: '08:00',
      workEnd: '18:00',
      lunchStart: '13:00',
      lunchEnd: '14:00',
      ...overrides,
    };
  }
}

export default DataFactory;

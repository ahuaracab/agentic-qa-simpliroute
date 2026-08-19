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

import type { TestCredentials, TestUser, TestVehicle, TestVisit } from './types';

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
   * Genera un vehículo completo para testing
   * @param overrides - Propiedades a sobreescribir
   */
  static createVehicle(overrides?: Partial<TestVehicle>): TestVehicle {
    return {
      name: `Vehículo ${faker.person.lastName()} ${this.uniqueId()}`,
      capacity_kg: faker.number.float({ min: 500, max: 2000, fractionDigits: 2 }),
      capacity_l: faker.number.float({ min: 500, max: 2000, fractionDigits: 2 }),
      average_speed_kmh: faker.number.float({ min: 30, max: 90, fractionDigits: 1 }),
      latitude: faker.location.latitude({ max: -33.4, min: -33.6, precision: 5 }),
      longitude: faker.location.longitude({ max: -70.6, min: -70.8, precision: 5 }),
      work_start: '08:00',
      work_end: '18:00',
      lunch_start: '13:00',
      lunch_end: '14:00',
      ...overrides,
    };
  }

  /**
   * Genera una visita de entrega completa para testing
   * @param overrides - Propiedades a sobreescribir
   */
  static createVisit(overrides?: Partial<TestVisit>): TestVisit {
    return {
      name: `Visita ${faker.location.city()} ${this.uniqueId()}`,
      address: faker.location.streetAddress(),
      latitude: faker.location.latitude({ max: -33.4, min: -33.6, precision: 5 }),
      longitude: faker.location.longitude({ max: -70.6, min: -70.8, precision: 5 }),
      service_time_minutes: faker.number.int({ min: 5, max: 30 }),
      priority: faker.number.int({ min: 1, max: 10 }),
      weight_kg: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
      volume_l: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
      time_window_start: null,
      time_window_end: null,
      ...overrides,
    };
  }

  /**
   * Genera una fecha de optimización futura (YYYY-MM-DD).
   * Usar un día futuro evita colisionar con recursos ocupados por runs previos.
   * @param daysFromToday - días a partir de hoy (default: 1)
   */
  static createOptimizationDate(daysFromToday = 1): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().slice(0, 10);
  }
}

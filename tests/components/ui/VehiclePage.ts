/**
 * KATA Architecture - Layer 3: Vehicle Page Component (UI)
 *
 * Route Optimizer - SPA frontend (Vite + React, tabs sin routing).
 * Base URL: config.baseUrl (local: http://127.0.0.1:5173).
 * Selectores: data-testid añadidos al target el 2026-08-10 (historia ROUTE-300).
 *
 * ATCs (mini-flujos atómicos):
 *   ROUTE-301 navigateToVehiclesSuccessfully — abrir la SPA + tab Vehículos
 *   ROUTE-302 createVehicleSuccessfully        — crear por el formulario + verificar en listado
 *   ROUTE-303 deleteVehicleSuccessfully        — eliminar desde el listado + verificar
 */

import type { TestVehicle } from '@data/types';
import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc } from '@utils/decorators';

// ============================================
// Vehicle Page Component (UI)
// ============================================

export class VehiclePage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Navegar a la pestaña Vehículos de la SPA.
   *
   * Complete flow: abre la raíz, confirma los tabs, activa Vehículos y
   * espera el formulario de creación (ROUTE-301).
   *
   * @atc ROUTE-301
   */
  @atc('ROUTE-301')
  async navigateToVehiclesSuccessfully(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByTestId('tab-vehicles')).toBeVisible();
    await this.page.getByTestId('tab-vehicles').click();
    await expect(this.page.getByTestId('vehicle-form')).toBeVisible();
  }

  /**
   * ATC: Crear un vehículo desde el formulario y verificarlo en el listado.
   *
   * Complete flow: llena todos los campos, intercepta el POST (201), confirma
   * el id creado y valida que la fila aparezca al buscar por nombre.
   * Devuelve el id creado para cleanup.
   *
   * @atc ROUTE-302
   */
  @atc('ROUTE-302')
  async createVehicleSuccessfully(vehicle: TestVehicle): Promise<number> {
    const form = this.page.getByTestId('vehicle-form');
    await expect(form).toBeVisible();

    await form.getByTestId('vehicle-name').fill(vehicle.name);
    await form.getByTestId('vehicle-capacity-kg').fill(String(vehicle.capacity_kg));
    await form.getByTestId('vehicle-capacity-l').fill(String(vehicle.capacity_l));
    await form.getByTestId('vehicle-speed').fill(String(vehicle.average_speed_kmh));
    await form.getByTestId('vehicle-latitude').fill(String(vehicle.latitude));
    await form.getByTestId('vehicle-longitude').fill(String(vehicle.longitude));
    await form.getByTestId('vehicle-work-start').fill(vehicle.work_start);
    await form.getByTestId('vehicle-work-end').fill(vehicle.work_end);
    await form.getByTestId('vehicle-lunch-start').fill(vehicle.lunch_start);
    await form.getByTestId('vehicle-lunch-end').fill(vehicle.lunch_end);

    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/vehicles/') && response.request().method() === 'POST',
    );
    await form.getByTestId('vehicle-submit').click();
    const response = await responsePromise;

    expect(response.status()).toBe(201);
    const created = (await response.json()) as { id: number };
    expect(created.id).toBeDefined();

    await this.searchByName(vehicle.name);
    await this.verifyRowVisible(vehicle.name);

    return created.id;
  }

  /**
   * ATC: Eliminar un vehículo desde el listado y verificar que desaparece.
   *
   * Complete flow: busca por nombre, localiza la fila, pulsa Eliminar y
   * confirma que la fila ya no existe (ROUTE-303).
   *
   * @atc ROUTE-303
   */
  @atc('ROUTE-303')
  async deleteVehicleSuccessfully(name: string): Promise<void> {
    await this.searchByName(name);

    const row = this.getRowByName(name);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Eliminar' }).click();
    await expect(row).toHaveCount(0);
  }

  // ============================================
  // Helpers (sin @atc - flujos de soporte)
  // ============================================

  /**
   * Busca un vehículo por nombre usando la barra de búsqueda del listado.
   * Extraído: se usa en create + delete (2+ usos).
   */
  async searchByName(name: string): Promise<void> {
    await this.page.getByTestId('vehicle-search').fill(name);
    await this.page.getByTestId('vehicle-search-submit').click();
  }

  /**
   * Localiza la fila del listado que contiene el nombre dado.
   * Extraído: se usa en create + delete (2+ usos).
   */
  getRowByName(name: string) {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  /** Verifica que una fila con el nombre sea visible (1 sola coincidencia). */
  private async verifyRowVisible(name: string): Promise<void> {
    const row = this.getRowByName(name);
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();
  }
}

# ROUTE-400 — Criterios de Aceptación

> Historia simulada derivada de `Caso 3.pdf` — detalle operativo de los ACs para la automatización (KATA).

## Trazabilidad AC → ATC

| AC | Descripción | ATCs API | Prioridad |
|----|-------------|----------|-----------|
| AC1 | Crear reserva válida (201, `pending_payment`, eco) | ROUTE-231 | Alta |
| AC2 | Validar duración permitida (60/90/120) | ROUTE-232 | Alta |
| AC3 | Validar acompañantes (máx 8) | ROUTE-233 | Media |
| AC4 | Validar campos obligatorios (`court_id`, `date`, `duration_minutes`) | ROUTE-234 | Alta |
| AC5 | Autenticación (401 token ausente/inválido) | ROUTE-235 | Alta |
| AC6 | Conflicto de horario (cancha tomada) | ROUTE-236 | Alta |
| AC7 | Consultar reserva (200 / 404) | ROUTE-237, ROUTE-238 | Alta |
| AC8 | Cancelar reserva (204 / ventana 24h / 404) | ROUTE-239, ROUTE-240, ROUTE-241 | Alta |

## ATCs propuestos (dominio Reservations — API)

| ATC | Método (propuesto) | Endpoint | Esperado |
|-----|--------------------|----------|----------|
| ROUTE-231 | `createReservationSuccessfully` | POST /reservations | 201 |
| ROUTE-232 | `createReservationWithInvalidDuration` | POST /reservations | 400/422 |
| ROUTE-233 | `createReservationWithGuestsOverLimit` | POST /reservations | 400/422 |
| ROUTE-234 | `createReservationWithMissingRequiredFields` | POST /reservations | 400/422 |
| ROUTE-235 | `createReservationUnauthorized` | POST /reservations | 401 |
| ROUTE-236 | `createReservationCourtConflict` | POST /reservations | 409* |
| ROUTE-237 | `retrieveReservationSuccessfully` | GET /reservations/{id} | 200 |
| ROUTE-238 | `retrieveReservationNotFound` | GET /reservations/{id} | 404 |
| ROUTE-239 | `cancelReservationWithinWindow` | DELETE /reservations/{id} | 204 |
| ROUTE-240 | `cancelReservationAfterDeadline` | DELETE /reservations/{id} | 400/409* |
| ROUTE-241 | `cancelReservationNotFound` | DELETE /reservations/{id} | 404 |

\* Código de conflicto no especificado en la spec — asumido `409` (ver gaps en `test-plan.md` §11).

## Notas de testabilidad

- Endpoint base: `https://api.bookit-demo.com/v1` (configurable vía `.env` en caso de automatizar).
- Auth: `Authorization: Bearer <token>`.
- Datos dinámicos con Faker (nunca estáticos): `court_id` de un catálogo precargado, `date` futura (`YYYY-MM-DD HH:MM`) y `duration_minutes` ∈ {60, 90, 120}.
- El `date` debe generarse ≥ 24h respecto al momento del test para permitir la cancelación (AC8).
- Cleanup de seguridad: cancelar la reserva creada (`ROUTE-239`) en `finally` del spec cuando aplique.
- El ejemplo del `Caso 3.pdf` muestra `guests: 12` pero el máximo documentado es 8 → inconsistencia de spec (gap G3, §11).

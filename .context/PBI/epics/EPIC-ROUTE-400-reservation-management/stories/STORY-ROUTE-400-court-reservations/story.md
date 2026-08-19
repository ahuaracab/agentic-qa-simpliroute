# STORY-ROUTE-400: Reservas de canchas vía API (BookIt)

> **Estado**: SIMULADO — historia derivada de la especificación `Caso 3.pdf` (API v1, https://api.bookit-demo.com/v1). No es un cache de sync (`[SYNC]`).
> **Fuente**: `Caso 3.pdf` (repo root).

## Título

Como administrador de canchas quiero crear, consultar y cancelar reservas de cancha a través de la API para gestionar la disponibilidad de horarios de forma segura.

## Criterios de Aceptación

- **AC1 — Crear una reserva válida**: Given que estoy autenticado y la cancha está disponible en el horario When envío `POST /reservations` con `court_id`, `date` y `duration_minutes` válidos Then la API responde `201` con un `id` generado, `status = pending_payment` y el eco de los datos enviados.
- **AC2 — Validar duración permitida**: Given una petición de reserva When `duration_minutes` es `60`, `90` o `120` Then se acepta; When es otro valor Then la API rechaza la petición (`400`/`422`).
- **AC3 — Validar acompañantes**: Given una petición de reserva When `guests` está ausente o es `≤ 8` Then se acepta; When `guests > 8` Then la API rechaza la petición.
- **AC4 — Validar campos obligatorios**: Given una petición de reserva When falta `court_id`, `date` o `duration_minutes` Then la API rechaza la petición con `400`/`422`.
- **AC5 — Autenticación**: Given un token ausente o inválido When invoco cualquier endpoint Then la API responde `401`.
- **AC6 — Conflicto de horario**: Given la cancha ya está tomada en ese horario When envío `POST /reservations` Then la API responde con un error de conflicto.
- **AC7 — Consultar una reserva**: Given una reserva existente When invoco `GET /reservations/{id}` Then la API responde `200` con los datos de la reserva; Given un id inexistente Then responde `404`.
- **AC8 — Cancelar una reserva**: Given una reserva con ≥ 24 horas antes del inicio When invoco `DELETE /reservations/{id}` Then la API responde `204` (cancelada); Given menos de 24 horas o reserva inexistente Then la cancelación es rechazada/`404`.

## Notas técnicas

- [x] API: `POST /reservations` (201) · `GET /reservations/{id}` (200/404) · `DELETE /reservations/{id}` (204/404)
- [x] Auth: header `Authorization: Bearer <token>` (401 si ausente/inválido)
- [ ] DB: fuera de alcance (API de terceros — BookIt)
- [ ] UI: no aplica (spec solo API)
- [ ] Dependencias: EPIC-ROUTE-400 (propuesto)

## Fuera de alcance

- Interfaz web / móvil de BookIt.
- Actualización parcial (PATCH/PUT) de reservas.
- Pago (transición a `confirmed` vía pago) y su flujo.
- Endpoints no documentados en el `Caso 3.pdf`.

## Relacionadas

- Pertenece a: EPIC-ROUTE-400 (propuesto)

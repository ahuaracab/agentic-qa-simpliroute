# STORY-ROUTE-400 — Test Plan: Reservas de canchas (BookIt API)

> Historia derivada de `Caso 3.pdf` (API v1, `https://api.bookit-demo.com/v1`).

## Header

- **Story**: STORY-ROUTE-400 — Reservas de canchas vía API (BookIt)
- **Epic**: EPIC-ROUTE-400-reservation-management (propuesto)
- **Sprint**: —
- **Fuente**: `Caso 3.pdf`
- **Tipo dominante**: API (contrato) / Funcional

## 1. Resumen de la especificación

| Endpoint | Método | Códigos documentados | Comportamiento clave |
|----------|--------|----------------------|----------------------|
| `/reservations` | POST | 201, 400, 401, 422 | Crea reserva; valida campos; conflicto si cancha tomada |
| `/reservations/{id}` | GET | 200, 404 | Devuelve reserva por id |
| `/reservations/{id}` | DELETE | 204, 404 | Cancela reserva solo hasta 24h antes del inicio |

**Campos de `POST /reservations`:**

| Campo | Tipo | Requerido | Reglas |
|-------|------|-----------|--------|
| `court_id` | integer | Sí | ID de la cancha |
| `date` | string | Sí | Fecha y hora de inicio (`YYYY-MM-DD HH:MM`) |
| `duration_minutes` | integer | Sí | Solo `60`, `90`, `120` |
| `guests` | integer | No | Máximo 8 |
| `notes` | string | No | Comentarios para el administrador |

**Respuesta 201 (ejemplo):** `{ "id": "res_8f3a21", "court_id": 12, "date": "2026-09-14 19:00", "duration_minutes": 90, "guests": 12, "notes": "Traemos pelotas propias", "status": "pending_payment", "created_at": "2026-08-10T14:22:05Z" }`

**Autenticación:** header `Authorization: Bearer <token>` en todos los endpoints.

## 2. AC → TC Mapping

| AC | Casos de prueba |
|----|-----------------|
| AC1 — Crear reserva válida | TC-001, TC-002 |
| AC2 — Validar duración | TC-002, TC-003 |
| AC3 — Validar acompañantes | TC-004, TC-005, TC-006 |
| AC4 — Campos obligatorios | TC-007 |
| AC5 — Autenticación | TC-008, TC-013, TC-016 |
| AC6 — Conflicto de horario | TC-009 |
| AC7 — Consultar reserva | TC-011, TC-012, TC-013 |
| AC8 — Cancelar reserva | TC-014, TC-015, TC-016, TC-017 |

## 3. Alcance

**In-scope**:
- Contrato de creación de reservas (`POST /reservations`): happy path, validaciones de campos, auth y conflicto.
- Consulta (`GET /reservations/{id}`) y cancelación (`DELETE /reservations/{id}`).
- Códigos de respuesta documentados y validación de estados (`pending_payment`, `confirmed`, `cancelled`, `completed`).

**Out-of-scope**:
- Flujo de pago y transición a `confirmed` por pago.
- Endpoints adicionales de BookIt no documentados (catálogo de canchas, disponibilidad, etc.).
- UI/móvil de BookIt.
- Rendimiento/carga y pruebas de seguridad avanzadas (fuzzing, rate-limit).

## 4. Tipos de prueba

| Tipo | Required | Razón |
|------|----------|-------|
| Funcional | Sí | Validar el cumplimiento del contrato de negocio (crear/consultar/cancelar) |
| API | Sí | Todo el alcance es de contrato REST |
| UI | No | Spec 100% API, sin interfaz en alcance |
| Perf | No | Sin SLAs documentados; fuera de alcance |
| Seguridad | Parcial | Solo auth (401). Sin fuzzing ni rate-limit |
| A11y | No | No aplica (API) |

## 5. Entornos de prueba

| Entorno | Uso |
|---------|-----|
| Local | No (no hay implementación local) |
| Staging | Sí — entorno recomendado para no contaminar datos reales |
| Prod (smoke) | No — evitar crear/cancelar reservas reales salvo sandbox |

> La base URL documentada es `https://api.bookit-demo.com/v1` (entorno de demostración).

## 6. Datos de prueba

- `court_id`: id de una cancha existente en el entorno (catálogo precargado). Mantener una cancha libre y otra ocupada para el TC-009.
- `date`: formato `YYYY-MM-DD HH:MM`, siempre **futura** (≥ 48h) para los flujos de creación y cancelación.
- `duration_minutes`: `60`, `90`, `120` (válidos); `30`, `45`, `180`, `0`, `-60`, `"noventa"`, `null` (inválidos).
- `guests`: `0`, `8` (límite), `9` (excede), `12` (ejemplo de la spec, excede), negativo, no entero, `null`.
- Token: token válido de un usuario autenticado; token ausente; token malformado (`abc`, caducado).
- `notes`: texto libre (corto, largo, vacío, Unicode/emojis).

## 7. Casos de prueba

### 7.1 Resumen

| TC | Descripción | Prioridad | Tipo | AC ref | ATC | Automatizable |
|----|-------------|-----------|------|--------|-----|---------------|
| TC-001 | Crear reserva válida → 201 | Alta | API | AC1 | ROUTE-231 | Sí |
| TC-002 | Duración válida en límites (60/90/120) → 201 | Alta | API | AC1, AC2 | ROUTE-231 | Sí |
| TC-003 | Duración inválida rechazada → 400/422 | Alta | API | AC2 | ROUTE-232 | Sí |
| TC-004 | `guests` ausente/opcional → 201 | Media | API | AC3 | ROUTE-231 | Sí |
| TC-005 | `guests = 8` (límite) → 201 | Media | API | AC3 | ROUTE-231 | Sí |
| TC-006 | `guests > 8` rechazado → 400/422 | Media | API | AC3 | ROUTE-233 | Sí |
| TC-007 | Campos obligatorios ausentes rechazados → 400/422 | Alta | API | AC4 | ROUTE-234 | Sí |
| TC-008 | Token ausente/inválido → 401 | Alta | API | AC5 | ROUTE-235 | Sí |
| TC-009 | Cancha tomada en el horario → conflicto | Alta | API | AC6 | ROUTE-236 | Sí |
| TC-010 | `court_id` inexistente → error | Media | API | AC1 | ROUTE-236* | Sí |
| TC-011 | Consultar reserva existente → 200 | Alta | API | AC7 | ROUTE-237 | Sí |
| TC-012 | Consultar reserva inexistente → 404 | Alta | API | AC7 | ROUTE-238 | Sí |
| TC-013 | Consultar sin token → 401 | Alta | API | AC5, AC7 | ROUTE-235 | Sí |
| TC-014 | Cancelar dentro de ventana (≥24h) → 204 | Alta | API | AC8 | ROUTE-239 | Sí |
| TC-015 | Cancelar fuera de ventana (<24h) rechazado → 400/409 | Alta | API | AC8 | ROUTE-240 | Sí |
| TC-016 | Cancelar sin token → 401 | Alta | API | AC5, AC8 | ROUTE-235 | Sí |
| TC-017 | Cancelar reserva inexistente → 404 | Alta | API | AC8 | ROUTE-241 | Sí |
| TC-018 | Estados de reserva válidos (`pending_payment`/`confirmed`/`cancelled`/`completed`) | Media | API | AC1, AC8 | ROUTE-231, ROUTE-239 | Sí |
| TC-019 | `date` en el pasado rechazado → 400/422 | Media | API | AC1 | ROUTE-232* | Sí |
| TC-020 | Formato de `date` inválido rechazado → 400/422 | Media | API | AC1 | ROUTE-232* | Sí |

\* ATC propuesto reutilizable (misma validación de payload); ver §7.2.

### 7.2 Detalle

#### TC-001 — Crear reserva válida (201)
- **AC**: AC1 · **ATC**: ROUTE-231 · **Prioridad**: Alta
- **Precondiciones**: token válido; cancha `court_id` disponible en el horario elegido; `date` futura.
- **Datos**: `{ "court_id": 12, "date": "2026-09-14 19:00", "duration_minutes": 90, "guests": 2, "notes": "Traemos pelotas propias" }`.
- **Pasos**:
  1. `POST /reservations` con el payload y header `Authorization: Bearer <token>`.
  2. Validar código de respuesta.
- **Esperado**: `201 Created`. Body con `id` definido (patrón `res_*`), `status = "pending_payment"`, y eco de `court_id`, `date`, `duration_minutes`, `guests`, `notes`; `created_at` presente.
- **Cleanup**: `DELETE /reservations/{id}` (TC-014) cuando el horario lo permita.

#### TC-002 — Duración válida en límites (60/90/120)
- **AC**: AC1, AC2 · **ATC**: ROUTE-231 · **Prioridad**: Alta
- **Datos**: misma base válida; subcasos con `duration_minutes` = `60`, `90`, `120`.
- **Esperado**: cada subcaso responde `201` con el `duration_minutes` enviado.

#### TC-003 — Duración inválida rechazada
- **AC**: AC2 · **ATC**: ROUTE-232 · **Prioridad**: Alta
- **Datos**: subcasos `duration_minutes` = `30`, `45`, `180`, `0`, `-60`, `"noventa"`, `null`, ausente.
- **Esperado**: código `400` o `422` (validación), `response.ok() == false`. Sin reserva creada.

#### TC-004 — `guests` opcional (ausente)
- **AC**: AC3 · **ATC**: ROUTE-231 · **Prioridad**: Media
- **Datos**: payload válido **sin** el campo `guests` (y sin `notes`).
- **Esperado**: `201`; el campo `guests` puede venir con un default (a validar con el contrato real).

#### TC-005 — `guests` en el límite (8)
- **AC**: AC3 · **ATC**: ROUTE-231 · **Prioridad**: Media
- **Datos**: `guests: 8`.
- **Esperado**: `201`.

#### TC-006 — `guests` sobre el límite (9 / 12)
- **AC**: AC3 · **ATC**: ROUTE-233 · **Prioridad**: Media
- **Datos**: subcasos `guests` = `9`, `12` (el ejemplo de la spec), `-1`, `1.5`, `"ocho"`.
- **Esperado**: `400`/`422`. Nota: el ejemplo del `Caso 3.pdf` muestra `guests: 12` con `201`, lo que contradice el máximo de 8 (ver gap G3).

#### TC-007 — Campos obligatorios ausentes
- **AC**: AC4 · **ATC**: ROUTE-234 · **Prioridad**: Alta
- **Datos**: subcasos omitiendo cada requerido — (a) sin `court_id`, (b) sin `date`, (c) sin `duration_minutes`, (d) body vacío `{}`.
- **Esperado**: `400`/`422`, `response.ok() == false`, mensaje de validación indicando el campo faltante.

#### TC-008 — Token ausente/inválido
- **AC**: AC5 · **ATC**: ROUTE-235 · **Prioridad**: Alta
- **Datos**: (a) sin header `Authorization`; (b) `Authorization: Bearer abc`; (c) token caducado/revocado.
- **Pasos**: `POST /reservations` con payload válido.
- **Esperado**: `401` en todos los subcasos; la reserva **no** se crea.

#### TC-009 — Cancha tomada en el horario (conflicto)
- **AC**: AC6 · **ATC**: ROUTE-236 · **Prioridad**: Alta
- **Precondiciones**: existe una reserva previa para `court_id` en `date` que cubre el mismo bloque horario (o se crea una primero vía TC-001).
- **Datos**: mismo `court_id` y `date` solapado (inicio dentro del rango [inicio, inicio+duration] de la reserva existente).
- **Esperado**: error de conflicto (asumido `409`, código no documentado — gap G2). La segunda reserva no se crea.

#### TC-010 — `court_id` inexistente
- **AC**: AC1 · **Prioridad**: Media
- **Datos**: `court_id: 999999` (inexistente), resto válido.
- **Esperado**: `400`/`404`/`422` (no documentado — gap G5). Validar que no se crea reserva.

#### TC-011 — Consultar reserva existente (200)
- **AC**: AC7 · **ATC**: ROUTE-237 · **Prioridad**: Alta
- **Precondiciones**: reserva creada vía TC-001 (guardar `id`).
- **Datos**: `GET /reservations/res_8f3a21` con token.
- **Esperado**: `200` con `id`, `court_id`, `date`, `status`; los valores coinciden con la reserva creada.

#### TC-012 — Consultar reserva inexistente (404)
- **AC**: AC7 · **ATC**: ROUTE-238 · **Prioridad**: Alta
- **Datos**: `GET /reservations/res_noexiste_999`.
- **Esperado**: `404`.

#### TC-013 — Consultar sin token (401)
- **AC**: AC5, AC7 · **Prioridad**: Alta
- **Datos**: `GET /reservations/{id}` sin header `Authorization`.
- **Esperado**: `401`.

#### TC-014 — Cancelar dentro de la ventana (204)
- **AC**: AC8 · **ATC**: ROUTE-239 · **Prioridad**: Alta
- **Precondiciones**: reserva creada con `date` ≥ 24h desde el momento actual (ej. hoy + 2 días).
- **Datos**: `DELETE /reservations/{id}` con token.
- **Esperado**: `204 No Content`. Una consulta posterior (`GET`) debe reflejar el estado `cancelled` (validación opcional según contrato).

#### TC-015 — Cancelar fuera de la ventana (< 24h)
- **AC**: AC8 · **ATC**: ROUTE-240 · **Prioridad**: Alta
- **Precondiciones**: reserva con `date` a menos de 24h (ej. hoy + 2 horas).
- **Esperado**: rechazo (`400` o `409`; código no documentado — gap G6). La reserva sigue vigente.

#### TC-016 — Cancelar sin token (401)
- **AC**: AC5, AC8 · **Prioridad**: Alta
- **Datos**: `DELETE /reservations/{id}` sin header `Authorization`.
- **Esperado**: `401`; la reserva sigue vigente.

#### TC-017 — Cancelar reserva inexistente (404)
- **AC**: AC8 · **ATC**: ROUTE-241 · **Prioridad**: Alta
- **Datos**: `DELETE /reservations/res_noexiste_999`.
- **Esperado**: `404`.

#### TC-018 — Estados de reserva válidos
- **AC**: AC1, AC8 · **Prioridad**: Media
- **Descripción**: verificar el dominio de `status` observado en las respuestas: `pending_payment` (creación), `confirmed` (ejemplo GET), `cancelled` (tras cancelación), `completed` (documentado en spec).
- **Esperado**: el `status` devuelto siempre pertenece al dominio `{ pending_payment, confirmed, cancelled, completed }`. Nota: `pending_payment` no está en el dominio listado en la spec (gap G1).

#### TC-019 — `date` en el pasado
- **AC**: AC1 · **Prioridad**: Media
- **Datos**: `date` anterior a la fecha actual (ej. "2020-01-01 10:00").
- **Esperado**: `400`/`422` (supuesto razonable, no documentado — gap G4); sin reserva creada.

#### TC-020 — Formato de `date` inválido
- **AC**: AC1 · **Prioridad**: Media
- **Datos**: `date` = `"14/09/2026 19:00"`, `"2026-09-14"`, `"2026-13-45 99:00"`, `""`, `null`.
- **Esperado**: `400`/`422` (formato esperado `YYYY-MM-DD HH:MM` — gap G4).

## 8. Edge cases y negativos

- **Concurrencia**: dos `POST /reservations` simultáneos al mismo `court_id`/`date` — verificar que solo uno gana y el otro recibe conflicto (relacionado con TC-009).
- **Solapamiento parcial**: reserva existente `19:00-20:30` (90 min) vs nueva `20:00-21:00` — ¿se considera conflicto? No documentado (gap G2).
- **Cancelación exactamente en el límite**: reserva con inicio exactamente a 24h — ¿se acepta? (boundary de AC8).
- **Ventana entre reservas**: reservas consecutivas sin hueco (`19:00-20:00` y `20:00-21:00`) — comportamiento no documentado.
- **Payload con tipos incorrectos**: `court_id` como string `"12"`, `duration_minutes` como string, `guests` como string.
- **`date` en otra zona horaria**: la spec no declara timezone — validar contra el comportamiento real (gap G4).
- **Idempotencia de DELETE**: eliminar la misma reserva dos veces (segundo intento → `404`).

## 9. Gaps y supuestos de la especificación

| # | Gap / ambigüedad | Impacto en tests | Supuesto propuesto |
|----|------------------|------------------|--------------------|
| G1 | `status = pending_payment` en la respuesta 201, pero el dominio documentado es `confirmed/cancelled/completed` | TC-018 | `pending_payment` es un estado inicial válido; ampliar dominio |
| G2 | Código del "error de conflicto" no especificado | TC-009, TC-015 | Asumir `409 Conflict` hasta confirmar |
| G3 | Ejemplo de request con `guests: 12` contradice el máximo de 8 | TC-006 | El máximo de 8 prevalece; el ejemplo es erróneo |
| G4 | Formato/timezone de `date` y comportamiento con fechas pasadas no documentados | TC-019, TC-020 | Asumir `YYYY-MM-DD HH:MM`, rechazo de pasados con 400/422 |
| G5 | `court_id` inexistente: código no documentado | TC-010 | Validar contra comportamiento real (400/404/422) |
| G6 | Código de rechazo al cancelar fuera de la ventana de 24h no documentado | TC-015 | Asumir `400`/`409` hasta confirmar |
| G7 | Auth (401) explícita solo para POST; se asume global | TC-013, TC-016 | Todos los endpoints exigen `Bearer` |
| G8 | Semántica del `422` incompleta en la tabla de códigos | TC-003/006/007 | Asumir validación de payload/regla de negocio |

## 10. Dependencias / Bloqueos / Riesgos

- **Dependencias**: catálogo de canchas con IDs conocidos y con disponibilidad controlada en el entorno; cuenta/usuario con token válido para generar el `Bearer`.
- **Bloqueos**: acceso/credenciales al entorno `api.bookit-demo.com` (o staging).
- **Riesgos**:
  - El entorno de demo comparte estado (otras reservas pueden ocupar canchas y provocar falsos conflictos) → usar cancha dedicada y `date` con baja probabilidad de colisión.
  - Los gaps G1–G8 requieren confirmación del dueño de producto / spec antes de fijar asserts estrictos.
  - La ventana de 24h limita la reutilización de reservas como fixtures (crear con `date` ≥ 48h).

## 11. Execution checklist + sign-off

- [ ] TC-001 ejecutado — [PASS/FAIL]
- [ ] TC-002 ejecutado — [PASS/FAIL]
- [ ] TC-003 ejecutado — [PASS/FAIL]
- [ ] TC-004 ejecutado — [PASS/FAIL]
- [ ] TC-005 ejecutado — [PASS/FAIL]
- [ ] TC-006 ejecutado — [PASS/FAIL]
- [ ] TC-007 ejecutado — [PASS/FAIL]
- [ ] TC-008 ejecutado — [PASS/FAIL]
- [ ] TC-009 ejecutado — [PASS/FAIL]
- [ ] TC-010 ejecutado — [PASS/FAIL]
- [ ] TC-011 ejecutado — [PASS/FAIL]
- [ ] TC-012 ejecutado — [PASS/FAIL]
- [ ] TC-013 ejecutado — [PASS/FAIL]
- [ ] TC-014 ejecutado — [PASS/FAIL]
- [ ] TC-015 ejecutado — [PASS/FAIL]
- [ ] TC-016 ejecutado — [PASS/FAIL]
- [ ] TC-017 ejecutado — [PASS/FAIL]
- [ ] TC-018 ejecutado — [PASS/FAIL]
- [ ] TC-019 ejecutado — [PASS/FAIL]
- [ ] TC-020 ejecutado — [PASS/FAIL]
- [ ] Gaps G1–G8 confirmados con el owner del producto
- [ ] Sign-off QA: [firma + fecha]

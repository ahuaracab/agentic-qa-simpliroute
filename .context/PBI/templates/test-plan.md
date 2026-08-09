# Formato de referencia — Test Plan (a nivel de Story)

> Guía de formato (reference-only). El contenido por-ticket NO se autoriza aquí: se sincroniza desde el issue tracker y se materializa por `/sprint-testing` (ATP/ATR). Este archivo documenta la FORMA canónica de un plan de prueba story-scoped. Placeholders explícitos: `[STORY-X]`, `[sprint]`, `[caso de prueba]`, `[AC-ref]`.

## Estructura canónica

- **Header**: story key, título, sprint.
- **Tabla AC → TC** (mapeo).
- **In-scope / Out-of-scope**.
- **Tipos de prueba** (Funcional / UI / API / Perf / Seguridad / A11y) con Required + Reason.
- **Entornos de prueba** (local / staging / prod-smoke).
- **Datos de prueba** (requerimientos).
- **Casos de prueba** (TC-001, TC-002, …) con prioridad, tipo, ref AC, flag automatizable.
- **Edge cases y tests negativos**.
- **Dependencias / blockers / riesgos**.
- **Execution checklist + sign-off**.

## Skeleton

```markdown
## Header

- **Story**: [STORY-X] — [título]
- **Sprint**: [sprint]

## AC → TC Mapping

| AC | Casos de prueba |
|----|-----------------|
| AC1 — [resumen] | TC-001, TC-002 |
| AC2 — [resumen] | TC-003 |

## Alcance

**In-scope**: [funcionalidades a probar]

**Out-of-scope**: [funcionalidades excluidas]

## Tipos de prueba

| Tipo | Required | Razón |
|------|----------|-------|
| Funcional | [sí/no] | [razón] |
| UI | [sí/no] | [razón] |
| API | [sí/no] | [razón] |
| Perf | [sí/no] | [razón] |
| Seguridad | [sí/no] | [razón] |
| A11y | [sí/no] | [razón] |

## Entornos de prueba

| Entorno | Uso |
|---------|-----|
| Local | [sí/no — razón] |
| Staging | [sí/no — razón] |
| Prod (smoke) | [sí/no — razón] |

## Datos de prueba

- [requerimiento de datos, fixtures, seed]

## Casos de prueba

| TC | Descripción | Prioridad | Tipo | AC ref | Automatizable |
|----|-------------|-----------|------|--------|---------------|
| TC-001 | [descripción] | [Alta/Media/Baja] | [Funcional/…] | AC1 | [sí/no] |
| TC-002 | [descripción] | [Alta/Media/Baja] | [Funcional/…] | AC2 | [sí/no] |

## Edge cases y negativos

- [caso límite / negativo]

## Dependencias / Bloqueos / Riesgos

- [dependencia, bloqueo o riesgo]

## Execution checklist + sign-off

- [ ] TC-001 ejecutado — [PASS/FAIL]
- [ ] TC-002 ejecutado — [PASS/FAIL]
- [ ] Sign-off QA: [firma + fecha]
```

## Discovery Gaps

- [ ] N/A — formato genérico; el contenido se completa por-ticket en `/sprint-testing` (ATP/ATR sincronizados desde el tracker).

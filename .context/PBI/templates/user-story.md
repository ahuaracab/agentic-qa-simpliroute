# Formato de referencia — User Story

> Guía de formato (reference-only). El contenido por-ticket NO se autoriza aquí: se sincroniza desde el issue tracker por `/sprint-testing` (`bun run jira:sync-issues get <KEY> --include-comments`). Este archivo documenta la FORMA canónica para revisión humana. Placeholders explícitos: `[persona]`, `[acción]`, `[beneficio]`.

## Estructura canónica

- **Formato**: `Como [persona] quiero [acción] para que [beneficio]`.
- **Criterios de Aceptación**: formato Given/When/Then, uno por AC, numerados (AC1, AC2, …).
- **Notas técnicas** (checklist): cambios de API / DB / UI, dependencias.
- **Fuera de alcance** (Out of Scope).
- **Design/Mockups**: enlace.
- **Historias relacionadas**: blocked-by / related-to.

## Skeleton

```markdown
## Título

Como [persona] quiero [acción] para que [beneficio].

### Criterios de Aceptación

- **AC1 — [resumen]**: Given [contexto] When [acción] Then [resultado verificable].
- **AC2 — [resumen]**: Given [contexto] When [acción] Then [resultado verificable].

### Notas técnicas

- [ ] API: [endpoint / contrato afectado]
- [ ] DB: [migración / entidad afectada]
- [ ] UI: [componente / flujo afectado]
- [ ] Dependencias: [bloqueado por / bloquea a]

### Fuera de alcance

- [ítem explícitamente NO incluido]

### Relacionadas

- Bloqueado por: [STORY-X]
- Relacionado a: [STORY-Y]
```

## Checklist de AC (enforzar)

- [ ] Específico y medible
- [ ] Testable (automatizable)
- [ ] Independiente (no asume otros ACs)
- [ ] Orientado a negocio (no detalle de implementación)

## Discovery Gaps

- [ ] N/A — formato genérico; la prevalencia de ACs vacíos se mide por-ticket en `/sprint-testing` desde el cache sincronizado (no se rellenan ACs aquí).

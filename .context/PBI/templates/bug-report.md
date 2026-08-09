# Formato de referencia — Bug Report (Defecto)

> Guía de formato (reference-only). El contenido por-ticket NO se autoriza aquí: se sincroniza desde el issue tracker por `/sprint-testing` y se clasifica según `agentic-qa-core/references/defect-management-doctrine.md` (Bug / Defect / Improvement). Este archivo documenta la FORMA canónica. Placeholders explícitos: `[entorno]`, `[navegador]`, `[SO]`, `[paso]`, `[esperado]`, `[actual]`.

## Estructura canónica

- **Resumen**: una línea.
- **Entorno**: tabla con environment, navegador, SO, tipo de usuario, fecha/hora.
- **Pasos para reproducir**: numerados.
- **Esperado vs Actual**.
- **Evidencia**: screenshots, console logs, network requests, video.
- **Impacto**: severidad, usuarios afectados, workaround, frecuencia.
- **Flag de regresión**: funcionaba antes / nunca funcionó / desconocido.
- **Issues relacionados**.

## Skeleton

```markdown
## Resumen

[resumen en una línea]

### Entorno

| Campo | Valor |
|-------|-------|
| Entorno | [local / qa / staging / production] |
| Navegador | [nombre + versión] |
| SO | [SO + versión] |
| Tipo de usuario | [rol / permisos] |
| Fecha/Hora | [YYYY-MM-DD HH:MM] |

### Pasos para reproducir

1. [paso 1]
2. [paso 2]
3. [paso 3]

### Esperado vs Actual

| | Descripción |
|---|---|
| Esperado | [comportamiento esperado] |
| Actual | [comportamiento observado] |

### Evidencia

- [ ] Screenshot(s) / video
- [ ] Console logs
- [ ] Network requests (request/response)
- [ ] Traza (trace) si está disponible

### Impacto

| Campo | Valor |
|-------|-------|
| Severidad | [Critical / High / Medium / Low] |
| Usuarios afectados | [rango] |
| Workaround | [sí/no + descripción] |
| Frecuencia | [siempre / intermitente / raro] |
| Regresión | [sí — funcionaba antes / no — nunca funcionó / desconocido] |

### Relacionados

- Story de origen: [STORY-X]
- Issues relacionados: [BUG-Y]
```

## Guía de severidad

| Severidad | Criterio | Ejemplo |
|-----------|----------|---------|
| Critical | Sistema caído, pérdida de datos, brecha de seguridad | No se puede iniciar sesión, pago falla |
| High | Feature principal roto, sin workaround | No se pueden crear órdenes |
| Medium | Feature afectado, existe workaround | Filtro roto, búsqueda funciona |
| Low | Cosmético, menor | Typo, alineación |

## Discovery Gaps

- [ ] N/A — formato genérico; la clasificación Bug/Defect/Improvement se aplica por-ticket según `defect-management-doctrine.md`.

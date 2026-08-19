# Frontend Infrastructure — Delivery Route Planner

> Discovery (reverse-engineering) · Generado: 2026-08-08 · Fase 3 (Infrastructure Discovery).
> Target: `../route-optimizer/frontend` (React 19 + Vite 8 + TypeScript + Leaflet). READ-ONLY — este documento no modifica el target.

## Stack Detection

| Señal | Archivo | Resultado |
|-------|---------|-----------|
| `vite.config.*` + dep `react` | `frontend/package.json:28` | Vite + React SPA (CSR) |
| Bundler | — | Rollup (Vite 8) |
| Tipo de build | — | SPA estático (sin SSR/SSG/ISR) |
| Config dev | `frontend/vite.config.ts:6-14` | host `127.0.0.1`, proxy `/api` → `http://127.0.0.1:8000` |
| Tests unit | `frontend/vite.config.ts:15-32` | Vitest 4 + jsdom + Testing Library, cobertura v8 |
| Tests e2e | — | **Eliminado del target (2026-08-08)** — E2E se ejecuta solo desde `agentic-qa-simpliroute` (Playwright propio, config sin webServer; el target se levanta manualmente) |
| Monorepo | — | NO (repo de 2 carpetas `backend/` + `frontend/`, sin workspaces) |

## Build Configuration

| Aspecto | Valor | Evidencia |
|---------|-------|-----------|
| Framework | React 19.2 (`react`, `react-dom`) | `package.json:28-29` |
| Bundler | Vite 8.2 (Rollup) | `package.json:22` |
| Plugin | `@vitejs/plugin-react` 6.0 | `package.json:26`, `vite.config.ts:1,5` |
| Output mode | SPA (CSR), salida `dist/` | `package.json:8` (`vite build`) |
| TypeScript | `~6.0.2`, modo **bundler**, `strict: true`, `noEmit: true` | `package.json:21`, `tsconfig.json:11-24` |
| JSX | `react-jsx` (runtime automático) | `tsconfig.json:8` |
| TS target/lib | `es2023` / `ES2023 + DOM + DOM.Iterable` | `tsconfig.json:3-5` |
| `tsconfig.include` | `["src", "vite.config.ts"]` | `tsconfig.json:25` |
| Build command | `tsc && vite build` (typecheck primero) | `package.json:8` |
| Dev command | `vite` | `package.json:7` |
| Preview | `vite preview` | `package.json:9` |
| Lint/Format | **No configurado** (sin eslint, prettier, ni script `lint`) | `package.json` completo |

> Anomalía menor: `@vitejs/plugin-react` está en `dependencies` (debería ser `devDependencies`) — `package.json:26`.

### Snippet clave — `frontend/vite.config.ts`

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: false,
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', '**/*.test.*'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
})
```

### E2E — eliminado del target

> **2026-08-08**: el target ya NO tiene infraestructura E2E propia (`frontend/e2e/`, `frontend/playwright.config.ts`, `backend/scripts/e2e_serve.py`, `backend/db.e2e.sqlite3` fueron eliminados). Los E2E corren exclusivamente desde `agentic-qa-simpliroute` (repositorio QA), cuya `playwright.config.ts` **no define webServer** — el target se levanta manualmente (backend `runserver 8000` + frontend `npm run dev`) y el runner de agentic apunta a `http://127.0.0.1:8000` / `http://127.0.0.1:5173`.

## Local Development Setup

Recipe copy-pasteable (Windows PowerShell, flujo del README del target):

```bash
# 1. Instalar dependencias
cd frontend
npm install

# 2. Levantar el servidor dev (proxy /api -> http://127.0.0.1:8000)
npm run dev      # http://127.0.0.1:5173 (requiere backend en :8000)

# 3. Verificar en el navegador
#    http://127.0.0.1:5173  -> lista de vehículos, visitas, optimización de ruta
```

> El E2E no levanta el frontend: `agentic-qa-simpliroute` asume el target corriendo en `127.0.0.1:5173` (Playwright sin webServer).

## Client Environment Variables

**No existe NINGUNA.** Escaneo `import.meta.env.VITE_*` / `import.meta.env` en `src/`: 0 coincidencias. No hay `.env`, `.env.example`, `.env.*` en `frontend/` ni en la raíz del target.

| Variable | Uso | Requerida | Build/Runtime | Evidencia |
|----------|-----|-----------|---------------|-----------|
| (ninguna) | — | — | — | `grep import.meta.env.VITE_ src/` → vacío; `Get-ChildItem *.env*` → vacío |

> **Nota de integración**: la base del API está hardcodeada como relativa `API_BASE = '/api'` (`src/api.ts:14`). En dev funciona por el proxy de Vite; **en producción el host que sirva el build debe exponer `/api` (reverse proxy o mismo origen)**, porque no hay `VITE_API_URL`.

### SECURITY CHECK (públicas VITE_*)

- **Resultado: sin hallazgos.** No se detectó ninguna variable pública con nombre sospechoso de secreto (p. ej. `VITE_*_SECRET_KEY`), por la simple razón de que el frontend no usa ninguna env pública.
- Riesgo latente (documentado, no corregido): si en el futuro se introduce una `VITE_*` para credenciales, quedaría expuesta en el bundle de `dist/` — el prefijo Vite es público por diseño. Regla: `VITE_*` solo para config no sensible (URLs públicas, feature flags).

## Environment-Specific Values (dev / staging / prod)

No aplica: **el frontend no lee ninguna env var**. Los únicos valores que varían por entorno son:

| Entorno | API base | Mecanismo | Nota |
|---------|----------|-----------|------|
| Dev | `/api` → proxy `127.0.0.1:8000` | `vite.config.ts:8-13` | Backend local requerido |
| Staging/Prod | `/api` (mismo origen) | Reverse proxy del host | Sin config de build separada (`vite build` idéntico) |

## Static Assets

```
frontend/public/
├── favicon.svg     # favicon del sitio (referenciado en index.html:5)
└── icons.svg       # hoja de iconos (no referenciada en source)
```

- `frontend/src/assets/` — `hero.png`, `typescript.svg`, `vite.svg` son **sobrantes de la plantilla de Vite**: ninguna es importada por el source (grep sin coincidencias). Candidatos a limpieza.
- `index.html:5` referencia `/favicon.svg`. No hay `robots.txt`, `sitemap.xml`, ni OG images.

### Image Handling

| Aspecto | Estado |
|---------|--------|
| Optimización de imágenes | Ninguna (no hay `vite-imagetools`/loaders; sin imágenes servidas por la app) |
| Tiles de mapa | OSM directo: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (`RouteOptimizer.tsx:252`) — sin API key, sin proxy ni subdominio custom |
| CDN / assetPrefix | No configurado |
| CSS de Leaflet | **No importado en el bundle** (ni en `main.tsx` ni `style.css`) — ver Discovery Gaps |

## Code Splitting Strategy

**No hay code splitting.** Escaneo `React.lazy` / `lazy(` / `import()` en `src/`: 0 coincidencias. Toda la app (incl. Leaflet/react-leaflet) cae en un único chunk de entrada.

## Bundle Size Notes

| Artefacto | Tamaño | Fuente |
|-----------|--------|--------|
| `dist/assets/index-*.js` | 354 859 B (~347 KB, sin gzip) | `dist/` (build 2026-08-08) |
| `dist/assets/index-*.css` | 1 713 B | `dist/` |
| Chunks | 1 JS + 1 CSS | `dist/assets/` |

- Sin bundle analyzer (`rollup-plugin-visualizer` ausente) → tamaño gzip/minificado y split por paquete **no medido** (gap).
- Leaflet es la mayor fuente de peso probable (sin verificación por paquete).

## Performance Configuration

| Config | Estado | Evidencia |
|--------|--------|-----------|
| Code splitting / lazy | Ausente | grep `React.lazy` → vacío |
| Optimización de fuentes | Ninguna (stack de sistema `'Segoe UI', system-ui, -apple-system, sans-serif`) | `style.css:24` |
| Prefetch / precarga | Ninguno (no `vite:preload` custom; Vite preload por defecto para chunks, pero solo hay 1) | — |
| Optimización de scripts | Ninguna custom | — |
| `react-leaflet` | `useMap` + `map.fitBounds` con debounce 100ms y `invalidateSize` | `RouteOptimizer.tsx:36-47` |
| Web Vitals / RUM | No medidos (sin `web-vitals`, Sentry, Lighthouse CI) | grep → vacío |
| Cache / prefetch de datos | Ninguno (cada montaje hace fetch) | `App.tsx:44-50`, `RouteOptimizer.tsx:71-73` |

## SEO Configuration

| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| `<html lang>` | `es` | `index.html:2` |
| Title | `Delivery Route Planner` | `index.html:7` |
| Meta description / keywords | Ausentes | `index.html` |
| Open Graph / Twitter cards | Ausentes | `index.html` |
| robots.txt / sitemap.xml | Ausentes | `public/` |
| Canonical / JSON-LD | Ausentes | — |
| SPA sin SSR | Motor de búsqueda ve solo el shell `#root` (SEO bajo, aceptable para herramienta interna) | `index.html:10` |

## Browser Support / Polyfills

- **Sin `browserslist`**, sin `@babel/preset-env`, sin polyfills manuales (no hay `core-js` en `package.json`).
- TS `target: es2023` / `lib: ES2023` (`tsconfig.json:3-5`) → el código transpilado asume navegadores modernos (es2023 + DOM).
- Vite 8: build target por defecto (`baseline-widely-available`/modules modernos); **no verificado en config** (gap).
- CI usa Node 20 (`qa.yml:38`); `package-lock.json:53` exige `^20.19.0 || ^22.12.0 || >=24`.
- E2E: sin soporte en el target; solo Chromium cubierto desde el runner de `agentic-qa-simpliroute`.

## Routing + State + Auth Integration Points

| Eje | Implementación | Evidencia |
|-----|----------------|-----------|
| **Router** | **Ninguno.** SPA con pestañas; tab controlado por `tab` state (`useState`) | `App.tsx:12,17,69-80` |
| **State global** | **Ninguno** (sin Redux/Zustand/Jotai). Todo `useState`/`useEffect` local | `App.tsx`, componentes |
| **Data fetching** | Wrapper `fetch` nativo en `src/api.ts:16-33` (`request<T>`); endpoints tipados en `api.ts:50-134` | `api.ts:14` (`API_BASE='/api'`) |
| **Data cache** | Ninguno (sin TanStack Query/SWR); re-fetch manual por acción | `App.tsx:26-60`, `OptimizationList.tsx` |
| **Auth** | **Ninguna** (API `AllowAny`). Sin sesión, token, cookie ni guard de ruta | `backend/config/settings.py:69-72` |
| **Mapa** | `react-leaflet` 5 (Leaflet 1.9), tiles OSM | `RouteOptimizer.tsx:246-275` |
| **Contratos TS** | `src/types.ts` (tipos manuales del API, no generados de OpenAPI) | `types.ts:1-96` |

### Test IDs strategy

- **No hay `data-testid` en código de producción.** La única aparición es en mocks de tests unitarios (`App.test.tsx:9`, `RouteOptimizer.test.tsx:15` — `div data-testid="map"` mockeando `MapContainer`).
- Estrategia real de selectores: **Testing Library por rol/label/texto** en unit (`getByRole`, `getByLabelText`, `getByText` — ver `VehicleForm.test.tsx:23-91`). El E2E desde `agentic-qa-simpliroute` usa selectores por rol/label/texto en español, con algunos locators de clase CSS (`.leaflet-container`, `.stops-list li`).
- Errores de UI: contrato accesible `role="alert"` (`App.tsx:83`, `RouteOptimizer.tsx:176`) — usado por los tests.

### Testing config resumen

| Nivel | Herramienta | Cobertura gate | Cómo corre |
|-------|-------------|----------------|------------|
| Unit/component | Vitest 4 + jsdom + @testing-library/react 16 + user-event | líneas/funciones/statements ≥80, branches ≥70 (`vite.config.ts:26-31`) | `npx vitest run` / `npx vitest run --coverage` |
| E2E | No existe en el target — se ejecuta desde `agentic-qa-simpliroute` (Playwright propio, target levantado manualmente) | — | `npx playwright test` en el repo agentic |
| Typecheck | `tsc --noEmit` (solo `src` + `vite.config.ts`) | — | `npx tsc --noEmit` |

## Discovery Gaps

- [ ] **CSS de Leaflet no importado**: ni `main.tsx` ni `style.css` importan `leaflet/dist/leaflet.css` → markers/popups probablemente degradados en navegador real (el e2e desde agentic usa `.leaflet-container`, no valida visualmente). Verificar visualmente y confirmar si hay import en otra capa.
- [ ] **Sobrantes de plantilla**: `src/assets/{hero.png,typescript.svg,vite.svg}` y `public/icons.svg` no referenciados (limpieza).
- [ ] **Infraestructura e2e eliminada del target** (2026-08-08): `frontend/e2e/`, `frontend/playwright.config.ts`, `backend/scripts/e2e_serve.py`, `backend/db.e2e.sqlite3` y el job `e2e` de `qa.yml` fueron removidos. El E2E vive ahora solo en `agentic-qa-simpliroute`.
- [ ] **Sin bundle analyzer / medición gzip**: tamaño por paquete (especialmente Leaflet) no verificado.
- [ ] **Sin browserslist ni target Vite explícito**: soporte exacto de navegadores no declarado; asumido moderno (es2023).
- [ ] **Sin Web Vitals/RUM/Lighthouse CI**: no hay métricas de rendimiento en runtime.
- [ ] **Sin lint/format**: `package.json` sin eslint/prettier — solo `tsc --noEmit` cubre calidad de código.
- [ ] **Build de producción no ejercitado**: `dist/` existe localmente pero **qa.yml no corre `npm run build`** (solo `tsc --noEmit` + vitest); el bundle prod nunca se valida en CI.
- [ ] **Valores por entorno (staging/prod) no verificables desde código**: no hay URLs de despliegue ni reverse-proxy documentado para `/api` en prod.

## QA Relevance

| Área | Qué testear | Notas |
|------|-------------|-------|
| API base relativa | En prod, `/api` debe resolver al backend (proxy/mismo origen); testar smoke e2e contra el target real | `api.ts:14` |
| Mapa | Render de polylines/markers, FitBounds, popups | E2E `routes.ts:20` valida solo `.leaflet-container`; cubrir contenido real |
| Errores | Contrato `role="alert"` en toda la app (fetch, transitions) | Usable como ancla accesible en e2e |
| Estados de optimización | Botones según estado (pending/confirmed/completed/cancelled); paradas delivered/failed | `RouteOptimizer.tsx:191-238` |
| Selectores | Sin `data-testid` en prod → tests dependen de labels/texto en español; cambios de copy rompen tests | No hay contrato de test ids |
| Cobertura | Gates 80/80/80/70 (l/branches) — el CI los aplica vía `vitest run --coverage` | `vite.config.ts:26-31` |
| CI | Job `frontend`: `npm ci` → `npx tsc --noEmit` → `npx vitest run --coverage` | `.github/workflows/qa.yml:29-43` |

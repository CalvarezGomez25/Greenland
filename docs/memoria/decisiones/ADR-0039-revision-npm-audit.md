# ADR-0039 · Revisión de los avisos de `npm audit` (P42)

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** |
| Fecha | 2026-11-04 |
| Quién decidió | Usuario: «revisar los avisos de npm audit» (P42) |

## Resultado
| | Antes (3 nov) | Después (4 nov) |
| --- | --- | --- |
| Total | 25 (24 moderados, 1 alto) | 23 (todos moderados) |
| Alto | `zod` (agotamiento de memoria; solo herramientas de desarrollo) | Resuelto: `zod` 4.6.5 → 4.6.7 |
| En producción | 8 moderados | 8 moderados, de un solo aviso |

## Qué se hizo
1. `zod` pasó de 4.6.5 a 4.6.7 (corrige GHSA-mrhx-c7xc-m3w5); llegaba por `eslint-plugin-react-hooks`, de ESLint.
2. `eslint-config-next` 16.4.0 → 16.4.5 y `typescript-eslint` 8.71.1 → 8.72.1 (actualizaciones menores).
3. `uuid` se fija en `^11.1.1` con `overrides` (corrige GHSA-w5hq-g745-h8pq). `exceljs` usaba `uuid` 8.3.2 y solo llama a `v4()` sin el argumento que dispara el fallo; aun así se actualizó porque es compatible (la versión 11 sigue ofreciendo CommonJS) y las pruebas de exportación pasan.

## Qué queda y por qué no se corrige
- **23 avisos moderados, todos de una sola causa:** `minimatch` (< 11.0.1, GHSA-g3hv-75wg-m249, denegación de servicio con patrones de archivo manipulados).
- **En producción (8):** vienen de `exceljs` → `archiver` → `readdir-glob` / `glob`. `exceljs` solo usa `archiver` en su modo de escritura por flujo, que esta plataforma no usa (se escribe con `writeBuffer`), y la función de patrones de `archiver` no se invoca con datos de nadie. No es alcanzable desde la aplicación.
- **En desarrollo (15):** ESLint y `typescript-eslint` (revisan nuestro código, no corren en producción).
- **Por qué no se fuerza:** `minimatch` 11 cambia su interfaz; forzarlo rompería ESLint y `glob`. Las «correcciones» que sugiere `npm audit fix --force` bajan `exceljs` a 3.4.0 y `eslint` a 4.0.0, es decir, versiones años atrás y con otros problemas. No se aplican.

## Cómo se vuelve a mirar
Cuando salgan `exceljs` o `eslint` con `minimatch` actualizado, `npm update` y repetir `npm audit --omit=dev`. Mientras tanto el riesgo residual es bajo y está documentado aquí y en P42.

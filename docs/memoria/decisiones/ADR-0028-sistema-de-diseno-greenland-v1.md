# ADR-0028 · Adoptar el sistema de diseño GreenLand v1.0.0 en toda la plataforma, sin versión paralela

| Campo | Valor |
| --- | --- |
| Estado | Aceptada y vigente |
| Fecha | 2026-10-21 |
| Quién decidió | Usuario: pidió usar el sistema de diseño renovado en toda la plataforma para desplegar con la nueva imagen corporativa y **dejó al asesor la decisión** de crear o no una versión aparte. La decisión de no crearla es del asesor |

## Contexto
El 21 de octubre de 2026 GreenLand publicó el sistema de diseño v1.0.0, que reemplaza al anterior: verde #027001, texto gris #5E5E5E, tipografía Archivo, solo dos radios, sin sombras ni mayúsculas sostenidas, tarjetas con muesca y una paleta de alertas sobria. La plataforma usaba Baloo 2, Roboto, verdes #4c700b y un acento tierra. Un tercio de la presentación vivía en tokens de color (nombres `leaf-*`, `soil-border`, `muted`) que se usan en cientos de lugares.

## Alternativas consideradas
| Opción | Evaluación |
| --- | --- |
| **A. Rama o versión paralela con la imagen anterior** | Descartada. La experiencia previa (lección L-15) mostró que Vercel no despliega ramas secundarias en esta cuenta; dos ramas se desfasan (lección L-18); y el propio sistema de diseño pide **no mantener versiones paralelas** |
| **B. Interruptor de tema en tiempo de ejecución** | Descartada. Duplicaría paleta, tipografía y componentes, sin que nadie la necesite, y contradice la misma regla |
| **C. Cambiar en la rama principal con una ancla de reversión** | **Elegida.** El cambio es solo de presentación (sin base de datos ni datos), concentrado en pocos puntos, y se puede revertir de una vez |

## Decisión
Aplicar el sistema en toda la interfaz, las exportaciones PDF y Excel, el informe gerencial y los correos. El trabajo se hizo en una rama local, se integró con un *merge* sin avance rápido (un único punto de reversión) y se publica en la rama principal.

**Cómo volver a la imagen anterior:**
1. Ancla: el estado inmediatamente anterior es el commit `4324528` (ESPECIFICACION v3.3.2). Intenté dejar además una etiqueta en el repositorio, pero el servidor rechazó el envío de etiquetas; por eso el ancla es el número del commit.
2. Reversión: `git revert -m 1 9df595b` (el commit del *merge*) deshace todo el cambio visual en un solo paso, sin tocar la base de datos. Luego, redesplegar.
3. Rápido, sin código: en Vercel, redesplegar el despliegue anterior (Deployments → el último con la imagen anterior → Promote o Redeploy). No lo verifiqué en el plan de la cuenta.

## Consecuencias
- Los nombres de los tokens heredados (`leaf-*`, `soil-border`, `muted`) se conservan y apuntan a la paleta oficial, para no tocar cada pantalla; el mapa está en `src/app/globals.css`.
- Verde, Amarillo y Rojo del semáforo conservan sus palabras y pasan a los colores de Cumple, Atención y Crítico (supuesto S20). El nivel de riesgo Alto usa Atención y Medio usa Informativo.
- Tarjetas de indicadores con muesca, tablas con encabezado verde, píldoras de contorno, campos en píldora y sin sombras. Excel con Archivo, encabezado #027001, bordes horizontales #E4E4E4 y sin cebra; PDF con Archivo incrustada (OFL).
- **Brechas (P39):** falta el paquete oficial del sistema (logotipos, íconos, plantillas); los íconos del menú lateral son de trazo propio y no vienen de la biblioteca cerrada de 20; no se incluye la fuente licenciada Non Natural Grotesk Plain; la paleta de alertas es una propuesta; el material de `docs/presentacion-faro/` conserva la imagen anterior.
- Para ver Archivo, el navegador la descarga de Google Fonts (como antes con Baloo 2 y Roboto). En Excel, si Archivo no está instalada, se usa la fuente de respaldo.

## Evidencia
Commits `506d98a` (interfaz) y `f6d9f22` (exportaciones, informe y correos); `src/app/globals.css`; `src/components/tarjeta-muesca.tsx`; `ESPECIFICACION.md` §1.1 e hito 26; capturas de verificación en escritorio y celular y muestras de PDF y Excel revisadas; 328 pruebas unitarias y 586 de base de datos correctas.

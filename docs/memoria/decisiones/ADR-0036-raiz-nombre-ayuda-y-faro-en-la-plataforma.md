# ADR-0036 · Nombre RAIZ para el módulo de aliados, ayuda ampliada y FARO dentro de la plataforma

| Campo | Valor |
| --- | --- |
| Estado | **Vigente** |
| Fecha | 2026-11-03 |
| Quién decidió | Usuario: usar el nombre **RAIZ (Registro de Aliados e Información centraliZada)** como título del módulo y **RAIZ** en el menú lateral; actualizar la guía PDF y la tarjeta; ampliar la ayuda; incorporar FARO en la plataforma |
| Migración | Ninguna |

## Decisión
1. **Nombre.** El módulo que antes se llamaba «Aliados y proveedores» se llama **RAIZ**. El título de la página es «RAIZ» con la línea «Registro de Aliados e Información centraliZada» y un ícono de ayuda; el menú lateral usa el nombre corto **RAIZ**. La ruta técnica sigue siendo `/aliados` (no se rompen enlaces ni marcadores). El nombre ya existía como «RAÍZ» en el paquete de origen; aquí se escribe en mayúsculas sin tilde porque así se escribe la sigla.
2. **Ayuda ampliada.** El glosario gana 14 conceptos (RAIZ, NIT o cédula, tipo de tercero, documentos del contratista, contratante, tope sin asamblea, proceso de contratación, modalidad, presupuesto de referencia, ronda, oferta habilitada, revisión de una novedad, ámbito de plantilla y campos de combinación) en una categoría nueva, «RAIZ, procesos y novedades». Se agregan íconos «?» a los campos de los formularios de RAIZ, contratos, pólizas, modificaciones, procesos, ofertas, novedades y plantillas, y a los títulos de las pantallas nuevas. Se agrega la guía paso a paso de RAIZ. Se corrigieron dos textos que habían quedado desactualizados: la ayuda del semáforo del contrato (ya cuenta pólizas, documentos y compromisos) y la nota bajo «Ruta del contrato».
3. **FARO dentro de la plataforma.** Nueva página **«Acerca de FARO»** (`/faro`), visible para todos los roles, con enlace en el menú lateral junto a «Ayuda» y desde la pantalla de Ayuda. Contiene el anillo de 360° con los cuatro cuartos, la frase «PMO360 es la luz; FARO es cómo la mantenemos encendida», los cuatro pasos con lo que la plataforma hace hoy (cada afirmación corresponde a una función existente), el origen del marco (11 de octubre de 2026, nombre elegido entre dos propuestas, casos reales descartados), el piloto de 90 días y lo que se declara de frente. No se cita ninguna cifra de ahorro. Se agrega el término `faro` al glosario.
4. **Materiales de comunicación.** La guía PDF pasa de 33 a 42 figuras (parte 4: RAIZ, contratación, novedades, documentos y FARO), la tarjeta de 4 a 6 caras (3 hojas a doble cara), la tabla de módulos suma cinco filas (24 a 28) y los correos se actualizan.

## Alternativas consideradas
- *Poner FARO en la pantalla de inicio o en el inicio de sesión:* descartado; recarga pantallas de trabajo y obliga a leer algo cada vez. Una página propia, enlazada desde el menú y la Ayuda, se consulta cuando se necesita.
- *Renombrar la ruta `/aliados` a `/raiz`:* descartado por ahora; cambia dirección sin beneficio para quien usa el menú y rompe marcadores. Puede hacerse con una redirección si se prefiere.
- *Mostrar FARO solo a ciertos roles:* descartado; es una explicación de la plataforma, sin datos de proyectos.

## Consecuencias
- Hay que mantener la página `/faro` alineada con la sección 17 de la especificación y con el ADR-0019 (si cambia lo que la plataforma hace, se ajustan las frases del paso correspondiente).
- Pendientes de FARO que siguen abiertos (P29): reemplazar los marcadores del material de presentación y decidir si las escenas ilustrativas se sustituyen por ejemplos reales no sensibles.

## Evidencia
`src/app/(app)/faro/page.tsx`, `src/lib/glosario.ts`, `src/lib/guias.ts`, `src/lib/navegacion.ts` (y su prueba), `docs/comunicaciones/*`.

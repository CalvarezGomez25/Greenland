# Sesión 2026-10-17 · Actividades y Kanban, exportaciones, inicio por rol, Microsoft 365 y administración

- **Participantes:** Carlos (propietario) y Claude. La jornada empezó el 16 de octubre (exploración del gestor colaborativo) y siguió el 17.
- **Objetivo:** explorar un gestor de trabajo tipo Trello, Asana o ClickUp dentro de PMO360 y, según lo que se fue pidiendo, llevarlo a producción; mejorar las exportaciones; ordenar la pantalla de inicio por rol; y dejar decidida la administración futura de la plataforma.
- **Qué se hizo** (con commits):
  - Módulo «Actividades» y «Mi trabajo» (migración 0024): `650d8a8`; movido a una rama aparte y restaurado en la principal: `3454ada`, `d50aa6a`.
  - Tablero Kanban con arrastrar y soltar: `a2be839`.
  - PDF y Excel con la identidad del informe gerencial: `72dc45c`.
  - Inicio por rol, interventoría sin tablero propio y corrección de «Mis proyectos»: `00cb5b3`, `9186580`, `78b5aa8`.
  - Pendientes P35 y P36 de administración: `4e85691`, `456700a`, `dd050a0`, `fd3c101`.
  - Guía para TI sobre Microsoft 365 (documento editable, fuera del repositorio): https://claude.ai/code/artifact/13eee31a-c754-4ef9-8904-86c5ded90492
  - Esta actualización de la memoria (ADR-0024 a ADR-0027, L-14 a L-17, fuentes, historia, trazabilidad y resumen).
- **Decisiones tomadas** (enlazar ADR): [ADR-0023](../decisiones/ADR-0023-actividades-y-mi-trabajo.md) (mínimo propio y su Kanban), [ADR-0024](../decisiones/ADR-0024-pantalla-de-inicio-por-rol.md), [ADR-0025](../decisiones/ADR-0025-exportaciones-con-identidad-de-marca.md), [ADR-0026](../decisiones/ADR-0026-integracion-con-microsoft-365.md) (propuesta), [ADR-0027](../decisiones/ADR-0027-administrador-unico-y-traspaso.md) (por construir). Delegado por el usuario a Claude: qué hacer con el tablero de la interventoría.
- **Incidentes o lecciones:** L-14 (administrador sin «Mis proyectos»), L-15 (rama que Vercel no podía desplegar), L-16 (columnas que no cabían a 1280 px), L-17 (comandos que cerraron la sesión).
- **Pendientes del usuario:** verificar en Vercel qué commit está desplegado (debe ser `78b5aa8` o posterior); estar agregado como miembro de sus proyectos para ver «Mis proyectos»; confirmar el plan de Microsoft 365 y enviar la guía a TI; M-8.
- **Pendientes de la plataforma:** traspaso automático al administrador de TI, Carlos a Analista PMO y permisos del director general (P35, P36; no se construyen hasta que el usuario lo pida); adopción de Actividades (P34); comentarios, adjuntos y avisos de Actividades solo si hay uso real.
- **Verificaciones ejecutadas** (con el último código, commit `78b5aa8`): `npx vitest run`: 328 pruebas correctas en 35 archivos. `npm run test:sql`: 586 comprobaciones correctas, 0 suites con fallos. `tsc`, `eslint` y `next build` sin errores. Pruebas en navegador real (Playwright) con un Supabase simulado: arrastre y persistencia, rechazo con vuelta atrás, inicio por rol con administrador, administrador con proyectos, gerente e interventoría. PDF y Excel revisados como imagen (el Excel convertido con LibreOffice).
- **Límites de lo registrado:** nada se probó contra el Supabase real del usuario; el Excel no se abrió en Excel; las páginas de Microsoft y de Supabase no se pudieron abrir (solo resultados del buscador); el plan de Microsoft 365 de la compañía no está confirmado; qué commit está desplegado en Vercel lo verifica el usuario.

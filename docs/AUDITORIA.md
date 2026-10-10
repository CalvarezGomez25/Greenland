# Auditoría de la plataforma (octubre de 2026)

Revisión independiente de la base de datos (migraciones 0001–0016) y del código de la aplicación, más un recorrido
real en navegador (pantalla de celular de 390 px, proyecto vacío y proyecto con datos, seis roles). Cada corrección
quedó cubierta por una prueba (`pruebas-sql/t-auditoria.mjs` y las pruebas unitarias).

## Corregido (migración 0017 y código)
| Gravedad | Hallazgo | Corrección |
| --- | --- | --- |
| Crítica | Un cambio podía ligarse al contrato de **otro proyecto** (leía su valor y, al aprobarse, lo modificaba) | Disparador que exige que el contrato sea del mismo proyecto |
| Alta | `linea_base_bac` (BAC) la podía llamar cualquier usuario, incluida la interventoría | Ya no es ejecutable por usuarios; solo la usan funciones internas |
| Alta | El gerente cerraba o reabría un proyecto desde «Editar» saltándose las validaciones del cierre | La ficha rechaza cambiar a/desde «Cerrado»; la lista ya no ofrece «Cerrado» |
| Alta | Al bajar el valor del contrato, el anticipo autorizado quedaba por encima del 20 % | El anticipo conserva el porcentaje autorizado; tope duro de 20 % en la tabla |
| Alta | Informes firmados y bitácora se alteraban al borrar el acta, la asignación o la tarea (`SET NULL`) | El borrado se rechaza (`NO ACTION`) |
| Alta | El gerente podía acortar o quitar la interventoría que lo vigila y así aprobar actas sin concepto | Solo administrador o director general cambian o quitan una asignación ya creada |
| Alta | El dashboard dejaba proyectos «sin datos» al pasar de 1.000 filas (Supabase entrega máximo 1.000) | Lectura por páginas |
| Media | Quien solo consulta podía generar mediciones calculadas con fechas futuras | Solo se calculan fechas futuras si puede gestionar el proyecto |
| Media | `dias_habiles_sumar` sin tope (consumo de CPU) | Máximo 366 días hábiles |
| Media | Un administrador podía quitarse el rol y dejar la plataforma sin administradores | Siempre queda al menos uno |
| Media | Quien registró un hallazgo lo seguía cerrando tras salir del proyecto | Debe seguir con acceso |
| Media | `0.123` se leía como 123 | Se rechaza (el punto solo separa miles) |
| Media | Presupuesto abierto por URL para la interventoría mostraba datos falsos | Redirige al proyecto |
| Media | Informe de interventoría: fechas sin zona horaria (perdía conceptos entre 7 p. m. y medianoche) | Hora de Colombia (UTC-5) |
| Media | PDF cortaba celdas más altas que una hoja; Excel/PDF truncaban centavos y mostraban «5,00» en conteos | Se reparten en varias hojas; centavos exactos; formato por fila |
| Media | Bitácora en celular: una sola foto, actividades sin descripción descartadas, números sin validar | Fotos acumulables (cámara o galería), avisos claros |
| Baja | Tarjetas de cifras desbordaban en 390 px; mensajes engañosos; fechas inexistentes (31 feb); extensión perdida en nombres no latinos; `/r/tareas` vacía | Corregidos |
| Instalación | Instalador podía borrar un presupuesto incompleto con datos; dos despliegues simultáneos podían chocar | Se detiene antes de borrar; bloqueo de un despliegue a la vez |

## Riesgos que quedan (decisiones de gobierno o de bajo impacto)
- **El gerente controla el denominador del nivel de un cambio.** Crear un contrato muy grande o registrar una medición con un BAC inflado hace que un cambio salga «Menor» y lo apruebe él mismo. Todo queda en la auditoría; la mitigación real es de proceso (el director revisa contratos nuevos) o limitar el valor del contrato respecto del BAC. Requiere una decisión.
- **Parámetros editables por el administrador** (`cambio_*`, `anticipo_umbral_*`): el tope de 20 % del anticipo ya es fijo, los demás umbrales siguen siendo configurables por diseño.
- **`cambios_presupuesto`** (registro de cambios del presupuesto) lo ven también finanzas y analista PMO, aunque un comentario antiguo decía solo administrador, director y gerente. Confirmar si es lo deseado.
- **Textos de error en la URL** (`?error=`): un enlace armado podría mostrar un mensaje falso dentro de la aplicación (sin ejecutar código ni dar acceso).
- **Fechas con `current_date` (UTC)** en algunos códigos y fechas por defecto: entre las 7 p. m. y la medianoche de Bogotá pueden salir con el día siguiente (y el 31 de diciembre, el año siguiente en el código del cambio).
- **Otros menores:** redondeo de centavos en actas sucesivas; ciclos en el árbol WBS; el gerente puede evaluar al patrocinador; un documento puede ligarse a un contrato de otro proyecto; `parametros_ver` muestra ajustes de otros proyectos; la conexión de migraciones usa SSL sin verificar el certificado; cada vista de proyecto carga datos del portafolio para calcular el semáforo.

## Lo que se verificó sin hallazgos
Las 47 tablas tienen RLS; `anon` no ejecuta funciones; nadie se sube el rol ni cambia su membresía; Storage aísla proyectos;
los `CREATE OR REPLACE` conservan permisos; divisiones por cero y desbordes de `numeric` protegidos; consecutivos atómicos.

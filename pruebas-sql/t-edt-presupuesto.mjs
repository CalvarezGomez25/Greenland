// Presupuesto sobre la EDT (migración 0020): capítulos desde la EDT, ligas y herencia en las tareas.
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co"), C = await usuario("c@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, S, "supervisor"], [P1, C, "consulta"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));

// EDT: raíz 1.0; hijos 1.1 Gestión, 1.2 Ingeniería, 1.3 Construcción; nietos 1.3.1 Estructura, 1.3.2 Acabados; bisnieto 1.3.1.1 Cimentación
const w = async (codigo, nombre, padre = null) => (await q("insert into public.wbs_elementos (proyecto_id, padre_id, codigo, nombre) values ($1,$2,$3,$4) returning id", [P1, padre, codigo, nombre]))[0].id;
const raiz = await w("1.0", "Obra 1");
const g11 = await w("1.1", "Gestión", raiz), g12 = await w("1.2", "Ingeniería", raiz), g13 = await w("1.3", "Construcción", raiz);
const g131 = await w("1.3.1", "Estructura", g13), g132 = await w("1.3.2", "Acabados", g13), g1311 = await w("1.3.1.1", "Cimentación", g131);
const tarea = async (nombre, wbs, cap = null) => (await q("insert into public.tareas (proyecto_id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, orden, wbs_id, capitulo_id) values ($1,$2,1,4,10,0,1,$3,$4) returning capitulo_id", [P1, nombre, wbs, cap]))[0].capitulo_id;
const caps = async () => (await q("select codigo, nombre, wbs_id from public.capitulos where proyecto_id=$1 order by orden", [P1]));
const desde = (u, p, n) => como(u, () => q("select public.capitulos_desde_edt($1::uuid,$2::integer) as r", [p, n])).then((r) => r[0].r);

const tAntes = await tarea("Tarea previa", g11); // sin capítulo todavía
ok(tAntes === null, "Una tarea ligada a la EDT, sin capítulos creados aún, queda sin capítulo");

seccion("Crear capítulos desde un nivel de la EDT");
let r = await desde(G, P1, 1);
ok(r.creados === 3 && r.ligados === 0, `Nivel 1: se crean 3 capítulos (1.1, 1.2, 1.3) → ${JSON.stringify(r)}`);
let c = await caps();
ok(c.map((x) => `${x.codigo} ${x.nombre}`).join("|") === "1.1 Gestión|1.2 Ingeniería|1.3 Construcción", "Con el código y el nombre de la EDT, en orden");
ok(c.every((x) => x.wbs_id !== null), "Todos quedan ligados a su elemento");
r = await desde(G, P1, 1);
ok(r.creados === 0 && r.ligados === 0, "Repetirlo no duplica nada");
ok((await q("select capitulo_id is not null as t from public.tareas where nombre='Tarea previa'"))[0].t === true, "La tarea que ya existía recibió el capítulo de su elemento");

seccion("Los capítulos de la EDT no se borran aunque estén vacíos");
await q("select public.limpiar_capitulos_vacios($1::uuid)", [P1]);
ok((await caps()).length === 3, "Siguen los 3 capítulos sin partidas");
await como(G, () => q("select public.partida_guardar($1::uuid, null, 'Suelto', '9.01', 'Algo', 'm2', 1, 1000, null)", [P1]));
await como(G, () => q("select public.partida_borrar((select id from public.apu_partidas where proyecto_id=$1 limit 1), 'prueba de limpieza')", [P1]));
await q("select public.limpiar_capitulos_vacios($1::uuid)", [P1]);
ok((await caps()).every((x) => x.nombre !== "Suelto"), "Un capítulo común sin partidas sí se retira");

seccion("Nivel 2, liga por nombre y herencia en las tareas");
await como(G, () => q("select public.partida_guardar($1::uuid, null, 'Acabados', '2.01', 'Pintura', 'm2', 10, 1000, null)", [P1]));
r = await desde(G, P1, 2);
ok(r.creados === 1 && r.ligados === 1, `Nivel 2: 'Estructura' se crea y el capítulo 'Acabados' que ya existía se liga → ${JSON.stringify(r)}`);
ok((await q("select count(*)::int n from public.capitulos where proyecto_id=$1 and lower(nombre)='acabados'", [P1]))[0].n === 1, "Sin duplicar 'Acabados'");
ok((await q("select wbs_id from public.capitulos where nombre='Acabados' and proyecto_id=$1", [P1]))[0].wbs_id === g132, "Ligado al elemento 1.3.2");
const cEstructura = (await q("select id from public.capitulos where wbs_id=$1", [g131]))[0].id;
ok(await tarea("Cimentar", g1311) === cEstructura, "Una tarea en 1.3.1.1 hereda el capítulo de su ancestro más cercano (1.3.1 Estructura)");
const cGestion = (await q("select id from public.capitulos where wbs_id=$1", [g11]))[0].id;
ok(await tarea("Con capítulo propio", g1311, cGestion) === cGestion, "Si la tarea ya trae capítulo, no se cambia");
ok(await tarea("Sin EDT", null) === null, "Sin EDT no hay herencia");

seccion("Liga por nombre de los capítulos existentes");
await como(G, () => q("select public.partida_guardar($1::uuid, null, 'ingeniería', '3.01', 'Planos', 'gl', 1, 5000, null)", [P1]).catch(() => {}));
ok((await como(G, () => q("select public.capitulos_vincular_edt($1::uuid) as n", [P1])))[0].n >= 0, "Se puede ligar lo existente sin error");

seccion("Permisos y validaciones");
await esperaError("El supervisor no crea capítulos", desde(S, P1, 1), /permiso/);
await esperaError("Consulta tampoco", desde(C, P1, 1), /permiso/);
await esperaError("El gerente de otra obra no", desde(G2, P1, 1), /permiso/);
await esperaError("Nivel fuera de rango", desde(G, P1, 9), /entre 0 y 6/);
await esperaError("Ligar capítulos también exige permiso", como(S, () => q("select public.capitulos_vincular_edt($1::uuid)", [P1])), /permiso/);

seccion("Integridad");
await q("delete from public.wbs_elementos where id=$1", [g1311]);
await q("delete from public.tareas where proyecto_id=$1", [P1]);
await q("delete from public.wbs_elementos where id=$1", [g132]);
ok((await q("select wbs_id from public.capitulos where nombre='Acabados' and proyecto_id=$1", [P1]))[0].wbs_id === null, "Al borrar el elemento de la EDT, el capítulo (con partidas) queda sin liga y sigue existiendo");
fin();

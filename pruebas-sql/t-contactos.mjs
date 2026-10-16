// Correo y teléfono de interesados y directorio de contactos reutilizable (migración 0023).
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"),
  AN = await usuario("an@x.co", "analista_pmo"), F = await usuario("f@x.co", "finanzas"),
  G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co"), I = await usuario("i@x.co"),
  SIN = await usuario("sin@x.co");
const nuevoProyecto = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await nuevoProyecto("Obra 1"), P2 = await nuevoProyecto("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, S, "supervisor"], [P1, I, "interventoria"]])
  await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const st = (u, p, n, extra = {}) => como(u, () => q(
  "insert into public.stakeholders (proyecto_id, nombre, poder, interes, rol, correo, telefono) values ($1,$2,3,3,$3,$4,$5) returning id, nombre, correo, telefono, contacto_id",
  [p, n, extra.rol ?? null, extra.correo ?? null, extra.telefono ?? null]));
const contactos = (u) => como(u, () => q("select * from public.contactos order by nombre"));

seccion("Correo y teléfono del interesado");
const a = (await st(G, P1, "Ana Pérez", { rol: "Interventora", correo: "  Ana.Perez@Empresa.co ", telefono: "+57 300 123 4567" }))[0];
ok(a.correo === "ana.perez@empresa.co", "El correo se guarda recortado y en minúsculas");
ok(a.telefono === "+57 300 123 4567", "El teléfono se guarda tal cual");
ok(a.contacto_id !== null, "El interesado queda vinculado a un contacto del directorio");
await esperaError("Correo inválido rechazado", st(G, P1, "Mal Correo", { correo: "no-es-correo" }), /check|violates/);
await esperaError("Teléfono con letras rechazado", st(G, P1, "Mal Tel", { telefono: "abc" }), /check|violates/);
await esperaError("Teléfono muy corto rechazado", st(G, P1, "Mal Tel", { telefono: "123" }), /check|violates/);
ok((await st(G, P1, "Sin datos de contacto"))[0].correo === null, "Correo y teléfono son opcionales");

seccion("Directorio: alta, reutilización y no duplicados");
let dir = await contactos(A);
ok(dir.length === 2 && dir.some((c) => c.correo === "ana.perez@empresa.co") && dir.some((c) => c.nombre === "Sin datos de contacto"), "Cada interesado nuevo crea su contacto (2)");
const b = (await st(G2, P2, "Ana P.", { correo: "ana.perez@empresa.co", telefono: "(601) 555 0101" }))[0];
ok(b.contacto_id === a.contacto_id, "El mismo correo en otro proyecto reutiliza el contacto");
dir = await contactos(A);
ok(dir.length === 2, "No se duplica el contacto");
const ana = dir.find((c) => c.correo === "ana.perez@empresa.co");
ok(ana.telefono === "(601) 555 0101" && ana.nombre === "Ana P.", "El último dato guardado actualiza el contacto");
ok(ana.rol === "Interventora", "Lo que llega vacío no borra el rol del directorio");
const c = (await st(G2, P2, "SIN DATOS DE CONTACTO"))[0];
ok(c.contacto_id !== null && (await contactos(A)).length === 2, "Sin correo se reutiliza por nombre, sin distinguir mayúsculas");
ok((await q("select count(*)::int n from public.stakeholders where contacto_id = $1", [a.contacto_id]))[0].n === 2, "Dos interesados de proyectos distintos comparten contacto");
// Poder, interés y necesidades son del proyecto
ok((await q("select poder, interes from public.stakeholders where proyecto_id=$1 and nombre='Ana P.'", [P2]))[0].poder === 3, "Poder e interés quedan en el interesado, no en el directorio");
const col = await q("select column_name from information_schema.columns where table_name='contactos'");
ok(!col.some((x) => ["poder", "interes", "necesidades"].includes(x.column_name)), "El directorio no guarda poder, interés ni necesidades");

seccion("Cambiar el correo cambia de contacto");
await como(G, () => q("update public.stakeholders set correo='otro@empresa.co' where id=$1", [a.id]));
dir = await contactos(A);
const nuevoId = (await q("select contacto_id from public.stakeholders where id=$1", [a.id]))[0].contacto_id;
ok(nuevoId !== a.contacto_id && dir.length === 3, "Un correo nuevo vincula o crea otro contacto");
await como(G, () => q("update public.stakeholders set poder=5 where id=$1", [a.id]));
ok((await q("select contacto_id from public.stakeholders where id=$1", [a.id]))[0].contacto_id === nuevoId, "Cambiar el poder no toca el directorio");

seccion("Quién ve y edita el directorio");
for (const [n, u] of [["Administrador", A], ["Director", D], ["Analista PMO", AN], ["Gerente", G], ["Otro gerente", G2]])
  ok((await contactos(u)).length === 3, `${n} ve el directorio`);
for (const [n, u] of [["Supervisor", S], ["Interventoría", I], ["Finanzas", F], ["Usuario sin rol", SIN]])
  ok((await contactos(u)).length === 0, `${n} no ve el directorio`);
await esperaError("Supervisor no crea contactos", como(S, () => q("insert into public.contactos (nombre) values ('x')")), /row-level/);
await esperaError("Supervisor no crea interesados", st(S, P1, "x"), /row-level/);
await esperaError("Otro gerente no crea interesados en P1", st(G2, P1, "x"), /row-level/);
await como(G, () => q("insert into public.contactos (nombre, correo) values ('Directo','directo@x.co')"));
ok((await contactos(A)).some((x) => x.correo === "directo@x.co"), "Un gerente agrega un contacto directo al directorio");
await como(AN, () => q("update public.contactos set telefono='3001234567' where correo='directo@x.co'"));
ok((await contactos(A)).find((x) => x.correo === "directo@x.co").telefono === "3001234567", "Analista PMO edita contactos");
await como(G, () => q("delete from public.contactos where correo='directo@x.co'"));
ok((await contactos(A)).some((x) => x.correo === "directo@x.co"), "Un gerente no borra contactos (la fila sigue existiendo)");
await como(A, () => q("delete from public.contactos where correo='directo@x.co'"));
ok(!(await contactos(A)).some((x) => x.correo === "directo@x.co"), "El administrador borra contactos");
await esperaError("Correo duplicado rechazado", como(G, () => q("insert into public.contactos (nombre, correo) values ('Dup','OTRO@empresa.co')")), /unique|duplicate/);
await como(A, () => q("delete from public.contactos where id=$1", [nuevoId]));
ok((await q("select contacto_id from public.stakeholders where id=$1", [a.id]))[0].contacto_id === null, "Borrar un contacto no borra al interesado: solo suelta el vínculo");

seccion("Interesados que ya existían (la migración los incorpora al directorio)");
// Se simula una base anterior: interesados sin vínculo y directorio vacío; luego corre la misma instrucción de la migración.
await q("alter table public.stakeholders disable trigger interesado_vincular_contacto");
await q("delete from public.stakeholders"); await q("delete from public.contactos");
await q("insert into public.stakeholders (proyecto_id, nombre, poder, interes, rol) values ($1,'Juan Gómez',3,3,'Contratista'), ($2,'juan gómez',4,2,null), ($1,'María Ruiz',2,2,null)", [P1, P2]);
await q("alter table public.stakeholders enable trigger interesado_vincular_contacto");
await q("update public.stakeholders set nombre = nombre");
ok((await q("select count(*)::int n from public.contactos"))[0].n === 2, "Los interesados repetidos por nombre generan un solo contacto (2 en total)");
ok((await q("select count(*)::int n from public.stakeholders where contacto_id is null"))[0].n === 0, "Todos los interesados quedan vinculados");
fin();

// Integración de contratos y costos (migración 0025): costos indirectos A.I.U., adicionales de obra y asignación de contratos al presupuesto.
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"), F = await usuario("f@x.co", "finanzas"),
  G = await usuario("g@x.co"), S = await usuario("s@x.co"), G2 = await usuario("g2@x.co"), I = await usuario("i@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P1, S, "supervisor"], [P2, G2, "gerente"], [P1, I, "interventoria"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const SIG = {
  costos_adicionales_plantilla: ["uuid"],
  adicional_guardar: ["uuid", "uuid", "text", "text", "numeric", "boolean", "uuid", "uuid", "text"],
  adicional_borrar: ["uuid"],
};
const fn = (u, n, ...a) => como(u, () => q(`select public.${n}(${a.map((x, i) => "$" + (i + 1) + "::" + SIG[n][i]).join(",")}) as r`, a.map((x) => x ?? null))).then((r) => r[0].r);

seccion("Costos indirectos (A.I.U.): categorías");
await fn(G, "costos_adicionales_plantilla", P1);
let lineas = await q("select nombre, categoria from public.costos_adicionales where proyecto_id=$1 order by orden", [P1]);
ok(lineas.map((l) => l.categoria).join(",") === "administracion,imprevistos,utilidad,impuestos,impuestos", `La plantilla asigna categorías: ${lineas.map((l) => l.categoria).join(",")}`);
const idAdm = (await q("select id from public.costos_adicionales where proyecto_id=$1 and categoria='administracion'", [P1]))[0].id;
await como(G, () => q("select public.costo_adicional_guardar($1::uuid,$2::uuid,'Administración','costo_directo',null,12,null,'administracion')", [P1, idAdm]));
ok((await q("select porcentaje::text p from public.costos_adicionales where id=$1", [idAdm]))[0].p === "12.0000", "Se edita el porcentaje conservando la categoría");
await esperaError("Categoría inválida rechazada", como(G, () => q("select public.costo_adicional_guardar($1::uuid,null,'Otro','costo_directo',null,1,null,'inventada')", [P1])), /tipo de costo/);
await esperaError("Supervisor no edita costos indirectos", como(S, () => q("select public.costo_adicional_guardar($1::uuid,null,'Otro','costo_directo',null,1,null,'otro')", [P1])), /permiso/);

seccion("Presupuesto, contratos y adicionales de prueba");
await como(G, () => q("select public.partida_guardar($1::uuid, null, 'Cimentación', '1.01', 'Concreto', 'm3', 10, 1000000, null)", [P1]));
await como(G, () => q("select public.partida_guardar($1::uuid, null, 'Estructura', '2.01', 'Columnas', 'm3', 20, 1000000, null)", [P1]));
const capC = (await q("select id from public.capitulos where proyecto_id=$1 and nombre='Cimentación'", [P1]))[0].id;
const capE = (await q("select id from public.capitulos where proyecto_id=$1 and nombre='Estructura'", [P1]))[0].id;
const crearC = async (u, p, valor, tipo = "obra") => {
  const id = (await como(u, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [p, JSON.stringify({ tipo, contratista: "Constructora X", objeto: "Obra civil", valor })])))[0].id;
  await como(D, () => q("select public.contrato_aprobar($1::uuid)", [id]));
  return id;
};
const C1 = await crearC(G, P1, "30000000"), CP2 = await crearC(G2, P2, "10000000");

seccion("Adicionales de obra");
const AD = await fn(G, "adicional_guardar", P1, null, "Cerramiento adicional del lote", "anadidura", 5000000, true, null, null, null);
let ad = (await q("select codigo, origen, valor_directo::text v, aplica_indirectos ai, cambio_id from public.adicionales where id=$1", [AD]))[0];
ok(ad.codigo === "AD-001" && ad.origen === "anadidura" && ad.v === "5000000.00" && ad.ai === true && ad.cambio_id === null, "Se crea con código consecutivo AD-001");
const AD2 = await fn(G, "adicional_guardar", P1, null, "Obras de drenaje no previstas", "no_contemplado", 2000000, false, null, null, "Aparecieron al excavar");
ok((await q("select codigo from public.adicionales where id=$1", [AD2]))[0].codigo === "AD-002", "El siguiente es AD-002");
await esperaError("Origen inválido", fn(G, "adicional_guardar", P1, null, "X", "raro", 1, true, null, null, null), /no estaba contemplado/);
await esperaError("Valor negativo", fn(G, "adicional_guardar", P1, null, "X", "anadidura", -1, true, null, null, null), /valor debe ser/);
await esperaError("Descripción vacía", fn(G, "adicional_guardar", P1, null, "  ", "anadidura", 1, true, null, null, null), /descripción/);
await esperaError("Supervisor no crea adicionales", fn(S, "adicional_guardar", P1, null, "X", "anadidura", 1, true, null, null, null), /permiso/);
await esperaError("Otro gerente no crea en este proyecto", fn(G2, "adicional_guardar", P1, null, "X", "anadidura", 1, true, null, null, null), /permiso/);
await esperaError("Elemento de EDT de otro proyecto", fn(G, "adicional_guardar", P1, null, "X", "anadidura", 1, true, "00000000-0000-4000-8000-000000000001", null, null), /EDT/);
await fn(G, "adicional_guardar", P1, AD, "Cerramiento adicional (ampliado)", "anadidura", 6000000, true, null, null, null);
ok((await q("select valor_directo::text v from public.adicionales where id=$1", [AD]))[0].v === "6000000.00", "Se edita el adicional");
ok((await como(S, () => q("select * from public.adicionales where proyecto_id=$1", [P1]))).length === 2, "El supervisor ve los adicionales");
ok((await como(I, () => q("select * from public.adicionales where proyecto_id=$1", [P1]))).length === 0, "La interventoría no ve los adicionales (como el presupuesto)");
ok((await como(G2, () => q("select * from public.adicionales where proyecto_id=$1", [P1]))).length === 0, "Otro gerente no los ve");
const [{ id: cam }] = await como(G, () => q("select 1 as x, gen_random_uuid() as id"));
await esperaError("Cambio inexistente", fn(G, "adicional_guardar", P1, AD, "X", "anadidura", 1, true, null, cam, null), /cambio no existe/);

seccion("Asignación de contratos al presupuesto");
const asignar = (u, c, cap, ad2, v) => como(u, () => q("select public.contrato_asignar($1::uuid,$2::uuid,$3::uuid,$4::numeric) as r", [c, cap, ad2, v])).then((r) => r[0].r);
const a1 = await asignar(G, C1, capC, null, 12000000);
ok(!!a1, "El gerente asigna 12 M del contrato al capítulo Cimentación");
await asignar(G, C1, capE, null, 10000000);
await asignar(G, C1, null, AD, 6000000);
ok((await q("select coalesce(sum(valor),0)::text s from public.contrato_asignaciones where contrato_id=$1", [C1]))[0].s === "28000000.00", "Capítulos y adicional suman 28 M (de 30 M del contrato)");
await asignar(G, C1, capC, null, 14000000);
ok((await q("select count(*)::int n, sum(valor)::text s from public.contrato_asignaciones where contrato_id=$1", [C1]))[0].n === 3, "Asignar de nuevo al mismo capítulo corrige el valor, no duplica");
await esperaError("No se supera el valor del contrato", asignar(G, C1, capC, null, 15000000), /supera el valor del contrato/);
await esperaError("Ni capítulo ni adicional", asignar(G, C1, null, null, 1), /capítulo o un adicional/);
await esperaError("Capítulo y adicional a la vez", asignar(G, C1, capC, AD2, 1), /solo uno/);
await esperaError("Valor cero", asignar(G, C1, capC, null, 0), /mayor que cero/);
await esperaError("Supervisor no asigna", asignar(S, C1, capC, null, 1000), /permiso/);
await esperaError("Otro gerente no asigna", asignar(G2, C1, capC, null, 1000), /permiso/);
await esperaError("Un contrato de otro proyecto no se asigna a capítulos de este", asignar(G2, CP2, capC, null, 1000), /permiso|no pertenece/);
await esperaError("Ni siquiera el administrador cruza proyectos", asignar(A, CP2, capC, null, 1000), /no pertenece/);
ok((await como(S, () => q("select * from public.contrato_asignaciones where proyecto_id=$1", [P1]))).length === 3, "El supervisor ve las asignaciones");
ok((await como(I, () => q("select * from public.contrato_asignaciones where proyecto_id=$1", [P1]))).length === 0, "La interventoría no ve las asignaciones");
await esperaError("Escritura directa denegada (solo por funciones)", como(G, () => q("insert into public.contrato_asignaciones (contrato_id, proyecto_id, capitulo_id, valor) values ($1,$2,$3,1)", [C1, P1, capE])), /permission|denegado|row-level/i);

seccion("El valor del contrato no baja de lo asignado");
await esperaError("Bajar el valor por debajo de lo asignado", q("update public.contratos set valor = 20000000 where id=$1", [C1]), /no puede ser menor/);
await q("update public.contratos set valor = 31000000 where id=$1", [C1]);
ok(true, "Subir el valor sí se permite");

seccion("Borrar adicionales y asignaciones");
await esperaError("No se borra un adicional con contratos asignados", fn(G, "adicional_borrar", AD), /contratos asignados/);
const idAdAsig = (await q("select id from public.contrato_asignaciones where adicional_id=$1", [AD]))[0].id;
await como(G, () => q("select public.contrato_asignacion_borrar($1::uuid)", [idAdAsig]));
await fn(G, "adicional_borrar", AD);
ok((await q("select count(*)::int n from public.adicionales where id=$1", [AD]))[0].n === 0, "Sin asignaciones, el adicional se borra");

seccion("Los capítulos con contratos asignados se conservan");
await q("select public.limpiar_capitulos_vacios($1::uuid)", [P1]);
await como(G, () => q("select public.partida_borrar((select id from public.apu_partidas where proyecto_id=$1 and codigo='2.01'), 'prueba')", [P1]));
await q("select public.limpiar_capitulos_vacios($1::uuid)", [P1]);
ok((await q("select count(*)::int n from public.capitulos where id=$1", [capE]))[0].n === 1, "Estructura quedó sin partidas pero conserva su capítulo porque tiene un contrato asignado");

seccion("Importar el presupuesto conserva las asignaciones");
const filas = JSON.stringify([
  { capitulo: "Cimentación", codigo: "1.01", descripcion: "Concreto", unidad: "m3", cantidad: "12", precio_unitario: "1000000" },
  { capitulo: "estructura", codigo: "2.01", descripcion: "Columnas", unidad: "m3", cantidad: "20", precio_unitario: "1000000" },
  { capitulo: "Acabados", codigo: "3.01", descripcion: "Pintura", unidad: "m2", cantidad: "100", precio_unitario: "20000" },
]);
await como(G, () => q("select public.presupuesto_importar($1::uuid,$2::jsonb,'Reemplazo de prueba')", [P1, filas]));
const reasignadas = await q("select c.nombre, a.valor::text v from public.contrato_asignaciones a join public.capitulos c on c.id=a.capitulo_id where a.contrato_id=$1 order by c.nombre", [C1]);
ok(reasignadas.length === 2 && reasignadas[0].v === "14000000.00" && reasignadas[1].v === "10000000.00", `Las asignaciones se religan por nombre de capítulo (${JSON.stringify(reasignadas)})`);
const filasSin = JSON.stringify([{ capitulo: "Acabados", codigo: "3.01", descripcion: "Pintura", unidad: "m2", cantidad: "100", precio_unitario: "20000" }]);
await esperaError("No se reemplaza si el archivo quita un capítulo con contratos asignados", como(G, () => q("select public.presupuesto_importar($1::uuid,$2::jsonb,'Sin capítulos asignados')", [P1, filasSin])), /contratos asignados a capítulos/);
ok((await q("select count(*)::int n from public.contrato_asignaciones where contrato_id=$1", [C1]))[0].n === 2, "Tras el intento fallido las asignaciones siguen intactas");

seccion("Auditoría");
ok((await q("select count(*)::int n from public.auditoria where tabla in ('adicionales','contrato_asignaciones')"))[0].n > 0, "Las operaciones quedan en la auditoría general");
fin();

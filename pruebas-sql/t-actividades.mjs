// Actividades: trabajo asignado a personas del proyecto (migración 0024).
import { nuevaBase, asignarInterventor, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"),
  AN = await usuario("an@x.co", "analista_pmo"), F = await usuario("f@x.co", "finanzas"),
  G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co"), C = await usuario("c@x.co"),
  I = await usuario("i@x.co"), I2 = await usuario("i2@x.co"), SIN = await usuario("sin@x.co");
const nuevoProyecto = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await nuevoProyecto("Obra 1"), P2 = await nuevoProyecto("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, S, "supervisor"], [P1, C, "consulta"], [P1, I, "interventoria"], [P1, I2, "interventoria"]])
  await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
await asignarInterventor(q, P1, I);
await asignarInterventor(q, P1, I2);
const [{ id: R1 }] = await como(G, () => q("insert into public.riesgos (proyecto_id, codigo, categoria, descripcion, probabilidad, impacto) values ($1,'R01','Técnico','Riesgo',3,3) returning id", [P1]));
const [{ id: R2 }] = await como(G2, () => q("insert into public.riesgos (proyecto_id, codigo, categoria, descripcion, probabilidad, impacto) values ($1,'R01','Técnico','Riesgo',3,3) returning id", [P2]));
const [{ id: W1 }] = await como(G, () => q("insert into public.wbs_elementos (proyecto_id, codigo, nombre) values ($1,'1.1','Gestión') returning id", [P1]));
const act = (u, p, t, extra = {}) => como(u, () => q(
  "insert into public.actividades (proyecto_id, titulo, responsable_id, fecha_limite, prioridad, riesgo_id, wbs_id) values ($1,$2,$3,$4,$5,$6,$7) returning *",
  [p, t, extra.resp ?? null, extra.fecha ?? null, extra.prioridad ?? "media", extra.riesgo ?? null, extra.wbs ?? null]));
const ver = (u, p) => como(u, () => q("select titulo from public.actividades where proyecto_id=$1 order by titulo", [p]));

seccion("Crear y ligar");
const a1 = (await act(G, P1, "  Revisar plan de mitigación  ", { resp: S, fecha: "2026-11-01", prioridad: "alta", riesgo: R1, wbs: W1 }))[0];
ok(a1.titulo === "Revisar plan de mitigación", "El título se guarda recortado");
ok(a1.estado === "por_hacer" && a1.creado_por === G && a1.completada_en === null, "Nace por hacer, con quien la creó y sin fecha de cierre");
ok((await act(AN, P1, "Del analista", { resp: G }))[0].responsable_id === G, "El analista PMO crea y asigna");
ok((await act(D, P1, "Del director", { resp: AN }))[0].responsable_id === AN, "El director general crea y puede asignar a un analista que no es miembro");
ok((await act(A, P1, "Del administrador"))[0].responsable_id === null, "El responsable es opcional (sin asignar)");
await esperaError("Título vacío rechazado", act(G, P1, "   "), /check|violates/);
await esperaError("Prioridad inválida rechazada", act(G, P1, "x", { prioridad: "urgente" }), /check|violates/);
await esperaError("Responsable que no es del equipo rechazado", act(G, P1, "x", { resp: SIN }), /equipo del proyecto/);
await esperaError("Responsable de otro proyecto rechazado", act(G, P1, "x", { resp: G2 }), /equipo del proyecto/);
await esperaError("Riesgo de otro proyecto rechazado", act(G, P1, "x", { riesgo: R2 }), /riesgo no pertenece/);

seccion("Quién crea, edita y borra");
await esperaError("Supervisor no crea", act(S, P1, "x", { resp: S }), /row-level/);
await esperaError("Consulta no crea", act(C, P1, "x"), /row-level/);
await esperaError("Finanzas no crea", act(F, P1, "x"), /row-level/);
await esperaError("Otro gerente no crea en P1", act(G2, P1, "x"), /row-level/);
await esperaError("Sin rol no crea", act(SIN, P1, "x"), /row-level/);
ok((await como(G, () => q("update public.actividades set titulo='Nuevo título', fecha_limite='2026-12-01' where id=$1 returning titulo", [a1.id])))[0].titulo === "Nuevo título", "El gerente edita sus campos");
ok((await como(AN, () => q("update public.actividades set prioridad='baja' where id=$1 returning prioridad", [a1.id])))[0].prioridad === "baja", "El analista edita");
const limpia = (await act(G, P1, "Sin ligas"))[0];
await esperaError("No se cambia el proyecto", como(A, () => q("update public.actividades set proyecto_id=$2 where id=$1", [limpia.id, P2])), /proyecto ni quién/);
await esperaError("No se cambia quién la creó", como(A, () => q("update public.actividades set creado_por=$2 where id=$1", [a1.id, S])), /proyecto ni quién/);

seccion("La persona responsable solo cambia el estado");
const r1 = await como(S, () => q("update public.actividades set estado='en_curso' where id=$1 returning estado, completada_en", [a1.id]));
ok(r1[0].estado === "en_curso" && r1[0].completada_en === null, "El responsable la pasa a en curso");
const r2 = await como(S, () => q("update public.actividades set estado='hecha' where id=$1 returning estado, completada_en", [a1.id]));
ok(r2[0].estado === "hecha" && r2[0].completada_en !== null, "Al marcarla hecha queda la fecha de cierre");
const r3 = await como(S, () => q("update public.actividades set estado='bloqueada' where id=$1 returning completada_en", [a1.id]));
ok(r3[0].completada_en === null, "Si se reabre, se borra la fecha de cierre");
await esperaError("El responsable no cambia el título", como(S, () => q("update public.actividades set titulo='Otro' where id=$1", [a1.id])), /Solo puedes cambiar el estado/);
await esperaError("El responsable no se la reasigna a otro", como(S, () => q("update public.actividades set responsable_id=$2 where id=$1", [a1.id, G]), /x/), /Solo puedes cambiar el estado/);
await esperaError("El responsable no cambia la fecha límite", como(S, () => q("update public.actividades set fecha_limite='2030-01-01' where id=$1", [a1.id])), /Solo puedes cambiar el estado/);
ok((await como(C, () => q("update public.actividades set estado='hecha' where id=$1 returning id", [a1.id]))).length === 0, "Quien no es responsable ni gestor no puede cambiar el estado");
await esperaError("El responsable no la borra", como(S, () => q("delete from public.actividades where id=$1", [a1.id])).then((r) => { if (!r.length) throw new Error("row-level"); }), /row-level/);
ok((await como(G, () => q("delete from public.actividades where id=$1 returning id", [a1.id]))).length === 1, "El gerente la borra");

seccion("Quién ve qué");
await act(G, P1, "Para el supervisor", { resp: S });
await act(G, P1, "Para la interventoría", { resp: I });
await act(G2, P2, "De otro proyecto");
const tit = (l) => l.map((x) => x.titulo);
for (const [n, u] of [["Administrador", A], ["Director", D], ["Analista PMO", AN], ["Finanzas", F], ["Gerente", G], ["Supervisor", S], ["Consulta", C]])
  ok(tit(await ver(u, P1)).includes("Para la interventoría") && tit(await ver(u, P1)).includes("Para el supervisor"), `${n} ve las actividades del proyecto`);
ok((await ver(G, P2)).length === 0, "El gerente de P1 no ve las de P2");
ok((await ver(SIN, P1)).length === 0, "Quien no tiene acceso no ve nada");
ok(tit(await ver(I, P1)).join() === "Para la interventoría", "Interventoría ve solo las que le asignaron");
ok((await ver(I2, P1)).length === 0, "Otro interventor no ve las ajenas");

seccion("Interventoría");
const ai = (await act(I, P1, "Mi seguimiento", { resp: I }))[0];
ok(ai.creado_por === I && ai.responsable_id === I, "La interventoría crea actividades para sí misma");
ok(tit(await ver(G, P1)).includes("Mi seguimiento"), "El gerente ve la actividad de la interventoría");
await esperaError("No le asigna a otra persona", act(I, P1, "x", { resp: G }), /row-level/);
await esperaError("No la deja sin responsable", act(I, P1, "x"), /row-level/);
await esperaError("No la liga a un riesgo", act(I, P1, "x", { resp: I, riesgo: R1 }), /row-level/);
ok((await como(I, () => q("update public.actividades set titulo='Mi seguimiento 2', prioridad='alta' where id=$1 returning titulo", [ai.id])))[0].titulo === "Mi seguimiento 2", "Edita las que creó");
await esperaError("No se la pasa a otra persona", como(I, () => q("update public.actividades set responsable_id=$2 where id=$1", [ai.id, G])), /row-level|Solo puedes/);
const asignada = (await como(I, () => q("select id from public.actividades where titulo='Para la interventoría'")))[0].id;
ok((await como(I, () => q("update public.actividades set estado='en_curso' where id=$1 returning estado", [asignada])))[0].estado === "en_curso", "Cambia el estado de la que le asignaron");
await esperaError("No edita el título de la que le asignaron", como(I, () => q("update public.actividades set titulo='x' where id=$1", [asignada])), /Solo puedes cambiar el estado/);
ok((await como(I2, () => q("update public.actividades set estado='hecha' where id=$1 returning id", [asignada]))).length === 0, "Otro interventor no toca la ajena");
ok((await como(I, () => q("delete from public.actividades where id=$1 returning id", [ai.id]))).length === 1, "Borra la que creó");
ok((await como(I, () => q("delete from public.actividades where id=$1 returning id", [asignada]))).length === 0, "No borra la que le asignaron");

seccion("Integridad y auditoría");
await como(A, () => q("delete from public.riesgos where id=$1", [R1]));
ok((await q("select count(*)::int n from public.actividades where riesgo_id is not null"))[0].n === 0, "Si se borra el riesgo, la actividad se conserva sin la liga");
await como(A, () => q("delete from public.miembros_proyecto where proyecto_id=$1 and usuario_id=$2", [P1, S]));
ok((await q("select count(*)::int n from public.actividades where titulo='Para el supervisor'"))[0].n === 1, "Si la persona sale del proyecto, la actividad se conserva");
ok((await q("select count(*)::int n from public.auditoria where tabla='actividades'"))[0].n > 0, "Los cambios quedan en la auditoría");
fin();

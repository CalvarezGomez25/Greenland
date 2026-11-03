// Aliados, capa 3 (migración 0028): procesos de contratación, ofertas, adjudicación y comunicaciones con compromisos.
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"), AN = await usuario("an@x.co", "analista_pmo"),
  G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co"), I = await usuario("i@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P1, S, "supervisor"], [P2, G2, "gerente"], [P1, I, "interventoria"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const ter = async (nit, n) => (await como(G, () => q("insert into public.terceros (nit, razon_social) values ($1,$2) returning id", [nit, n])))[0].id;
const T1 = await ter("900.555.666-1", "Oferente Uno S.A.S."), T2 = await ter("900.777.888-2", "Oferente Dos S.A.S."), T3 = await ter("PEND-TRES", "Oferente Tres");

seccion("Parámetros");
for (const k of ["peso_precio", "peso_experiencia", "peso_capacidad", "peso_programacion", "peso_comercial", "peso_sst", "proceso_eval_dias"])
  ok((await q("select count(*)::int c from public.parametros where clave=$1 and ambito='global'", [k]))[0].c === 1, `Parámetro ${k}`);
const suma = (await q("select sum(valor::numeric)::text s from public.parametros where clave in ('peso_experiencia','peso_capacidad','peso_programacion','peso_comercial','peso_sst')"))[0].s;
ok(Number(suma) === 0.6, `Los cinco pesos cualitativos suman 0,60 (sobre el 60 % restante al precio): ${suma}`);

seccion("Procesos");
const pr = (u, p, d, id = null) => como(u, () => q("select public.proceso_guardar($1::uuid,$2::uuid,$3::jsonb) as id", [p, id, JSON.stringify(d)])).then((r) => r[0].id);
const PR1 = await pr(G, P1, { objeto: "Obra civil de la bodega", tipo_servicio: "obra_civil", cierre_propuestas: "2026-12-01", presupuesto_referencia: "500000000", estado: "abierta" });
const PR2 = await pr(G, P1, { objeto: "Suministro de acero" });
ok((await q("select codigo from public.procesos where id=$1", [PR1]))[0].codigo === "PR-01" && (await q("select codigo, estado from public.procesos where id=$1", [PR2]))[0].codigo === "PR-02", "Códigos PR-01 y PR-02 consecutivos por proyecto");
ok((await q("select estado from public.procesos where id=$1", [PR2]))[0].estado === "en_preparacion", "Un proceso nuevo nace en preparación");
await esperaError("El supervisor no crea procesos", pr(S, P1, { objeto: "x" }), /permiso/);
await esperaError("El gerente de otro proyecto tampoco", pr(G2, P1, { objeto: "x" }), /permiso/);
await esperaError("El objeto es obligatorio", pr(G, P1, { objeto: "" }), /Describe/);
await esperaError("No puede nacer adjudicado", pr(G, P1, { objeto: "x", estado: "adjudicada" }), /nuevo no puede/);
await esperaError("Estado desconocido", pr(G, P1, { objeto: "x", estado: "magia" }), /no es válido/);
await esperaError("Enlace inválido", pr(G, P1, { objeto: "x", enlace: "javascript:1" }), /http/);
ok((await como(S, () => q("select count(*)::int c from public.procesos")))[0].c === 2, "El supervisor ve los procesos");
ok((await como(I, () => q("select count(*)::int c from public.procesos")))[0].c === 0, "La interventoría no ve procesos (recomienda, no adjudica)");
ok((await como(G2, () => q("select count(*)::int c from public.procesos")))[0].c === 0, "Otro proyecto no ve los procesos");

seccion("Ofertas");
const of = (u, proc, d, id = null) => como(u, () => q("select public.oferta_guardar($1::uuid,$2::uuid,$3::jsonb) as id", [proc, id, JSON.stringify(d)])).then((r) => r[0].id);
const O1 = await of(G, PR1, { tercero_id: T1, estado: "recibida", fecha_recepcion: "2026-11-20", valor_total: "400000000", plazo_dias: "120", vigencia_hasta: "2026-12-31", habilitada: "si", crit_experiencia: "5", crit_capacidad: "4", crit_programacion: "4", crit_comercial: "3", crit_sst: "5" });
const O2 = await of(G, PR1, { tercero_id: T2, estado: "recibida", valor_total: "450000000", habilitada: "no" });
const O3 = await of(G, PR1, { tercero_id: T3, estado: "invitado" });
ok((await q("select codigo, oferente, ronda from public.ofertas where id=$1", [O1]))[0].codigo === "OF-001", "Código OF-001 y siguientes");
ok((await q("select oferente from public.ofertas where id=$1", [O3]))[0].oferente === "Oferente Tres", "La oferta guarda el nombre del oferente");
await esperaError("El mismo oferente no repite en la ronda", of(G, PR1, { tercero_id: T1 }), /ya tiene una oferta/);
await of(G, PR1, { tercero_id: T1, ronda: "2", estado: "recibida", valor_total: "380000000" });
ok((await q("select count(*)::int c from public.ofertas where proceso_id=$1", [PR1]))[0].c === 4, "Sí en otra ronda");
await esperaError("Calificación fuera de 1 a 5", of(G, PR1, { tercero_id: T3, ronda: "3", crit_sst: "6" }), /rangos/);
await esperaError("Oferente que no existe", of(G, PR1, { tercero_id: "00000000-0000-0000-0000-000000000000", ronda: "3" }), /maestro/);
await esperaError("El supervisor no registra ofertas", of(S, PR1, { tercero_id: T3, ronda: "3" }), /permiso/);
await esperaError("La ronda de una oferta no cambia", of(G, PR1, { ronda: "2", valor_total: "1" }, O1), /ronda/);
await of(G, PR1, { valor_total: "395000000", estado: "recibida", habilitada: "si", crit_experiencia: "5", crit_capacidad: "4", crit_programacion: "4", crit_comercial: "3", crit_sst: "5", fecha_recepcion: "2026-11-20", vigencia_hasta: "2026-12-31" }, O1);
ok((await q("select valor_total::text v from public.ofertas where id=$1", [O1]))[0].v === "395000000.00", "Se corrige una oferta");
ok((await como(I, () => q("select count(*)::int c from public.ofertas")))[0].c === 0, "La interventoría no ve ofertas");
ok((await como(S, () => q("select count(*)::int c from public.ofertas")))[0].c === 4, "El supervisor sí las ve");

seccion("Adjudicación");
const adj = (u, p, o) => como(u, () => q("select public.proceso_adjudicar($1::uuid,$2::uuid)", [p, o]));
await esperaError("No se adjudica una oferta no habilitada", adj(G, PR1, O2), /habilitada/);
await esperaError("No se adjudica una oferta sin recibir", adj(G, PR1, O3), /recibida/);
await esperaError("Un proceso en preparación no se adjudica", adj(G, PR2, O1), /abierto|no existe/);
await esperaError("El supervisor no adjudica", adj(S, PR1, O1), /permiso/);
await esperaError("El estado «adjudicada» no se escribe a mano", pr(G, P1, { objeto: "Obra civil de la bodega", estado: "adjudicada" }, PR1), /Adjudicar/);
await esperaError("Ni en una oferta", of(G, PR1, { estado: "adjudicada", valor_total: "1" }, O2), /Adjudicar/);
await adj(G, PR1, O1);
let p1 = (await q("select estado, adjudicatario_id from public.procesos where id=$1", [PR1]))[0];
ok(p1.estado === "adjudicada" && p1.adjudicatario_id === T1, "Adjudicado: el proceso queda con su adjudicatario");
ok((await q("select estado from public.ofertas where id=$1", [O1]))[0].estado === "adjudicada", "La oferta queda adjudicada");
await esperaError("Una oferta adjudicada no se borra", como(G, () => q("select public.oferta_borrar($1::uuid)", [O1])), /adjudicada/);
await esperaError("Ni cambia de estado suelta", of(G, PR1, { estado: "recibida", valor_total: "395000000" }, O1), /devolver la adjudicación/);
await esperaError("Un proceso adjudicado no se borra", como(G, () => q("select public.proceso_borrar($1::uuid)", [PR1])), /no se borra/);

seccion("Del proceso al contrato");
const crearC = (tercero) => como(G, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [P1, JSON.stringify({ tipo: "obra", objeto: "Obra civil de la bodega", valor: "395000000", tercero_id: tercero })])).then((r) => r[0].id);
const Cmal = await crearC(T2), C = await crearC(T1);
const vinc = (u, c) => como(u, () => q("select public.proceso_contrato_vincular($1::uuid,$2::uuid)", [PR1, c]));
await esperaError("El contrato debe ser del adjudicatario", vinc(G, Cmal), /adjudicatario/);
await vinc(G, C);
ok((await q("select contrato_id from public.procesos where id=$1", [PR1]))[0].contrato_id === C, "El contrato queda vinculado al proceso");
await esperaError("Con contrato no se devuelve la adjudicación", pr(G, P1, { objeto: "Obra civil de la bodega", estado: "en_evaluacion" }, PR1), /ya tiene un contrato/);
await esperaError("El proceso sin adjudicar no vincula contrato", como(G, () => q("select public.proceso_contrato_vincular($1::uuid,$2::uuid)", [PR2, C])), /no está adjudicado/);

seccion("Devolver la adjudicación y borrar");
const O4 = await of(G, PR2, { tercero_id: T2, estado: "recibida", valor_total: "10000000", habilitada: "si" });
await pr(G, P1, { objeto: "Suministro de acero", estado: "abierta" }, PR2);
await adj(G, PR2, O4);
await pr(G, P1, { objeto: "Suministro de acero", estado: "en_evaluacion" }, PR2);
const dev = (await q("select p.estado pe, p.adjudicatario_id a, o.estado oe from public.procesos p join public.ofertas o on o.proceso_id = p.id where p.id=$1", [PR2]))[0];
ok(dev.pe === "en_evaluacion" && dev.a === null && dev.oe === "recibida", "Sin contrato, se devuelve la adjudicación y la oferta vuelve a «recibida»");
await como(G, () => q("select public.oferta_borrar($1::uuid)", [O4]));
await como(G, () => q("select public.proceso_borrar($1::uuid)", [PR2]));
ok((await q("select count(*)::int c from public.procesos where id=$1", [PR2]))[0].c === 0, "Un proceso sin adjudicar se borra con sus ofertas");

seccion("Comunicaciones y compromisos");
const com = (u, d, id = null) => como(u, () => q("select public.comunicacion_guardar($1::uuid,$2::uuid,$3::jsonb) as id", [C, id, JSON.stringify(d)])).then((r) => r[0].id);
await como(D, () => q("select public.contrato_aprobar($1::uuid)", [C]));
const CM = await com(G, { fecha: "2026-11-02", canal: "reunion", asunto: "Reunión de arranque", resumen: "Se acordó entregar pólizas", responsable: "Contratista", requiere_accion: "si", fecha_compromiso: "2026-11-10" });
ok((await q("select estado, requiere_accion from public.contrato_comunicaciones where id=$1", [CM]))[0].requiere_accion === true, "Se registra una comunicación con compromiso");
await esperaError("Un compromiso abierto necesita fecha", com(G, { fecha: "2026-11-02", asunto: "x", requiere_accion: "si" }), /necesita su fecha/);
await esperaError("El asunto es obligatorio", com(G, { fecha: "2026-11-02", asunto: "" }), /asunto/);
await esperaError("La fecha es obligatoria", com(G, { asunto: "x" }), /fecha de la comunicación/);
await esperaError("Canal desconocido", com(G, { fecha: "2026-11-02", asunto: "x", canal: "paloma" }), /no es válido/);
await esperaError("El supervisor no registra comunicaciones", com(S, { fecha: "2026-11-02", asunto: "x" }), /permiso/);
await com(G, { fecha: "2026-11-02", canal: "reunion", asunto: "Reunión de arranque", requiere_accion: "si", fecha_compromiso: "2026-11-10", estado: "cerrado" }, CM);
ok((await q("select estado from public.contrato_comunicaciones where id=$1", [CM]))[0].estado === "cerrado", "Se cierra el compromiso");
ok((await como(S, () => q("select count(*)::int c from public.contrato_comunicaciones")))[0].c === 1, "El supervisor ve las comunicaciones del contrato");
ok((await como(I, () => q("select count(*)::int c from public.contrato_comunicaciones")))[0].c === 0, "La interventoría sin asignación no las ve");
await como(G, () => q("select public.comunicacion_borrar($1::uuid)", [CM]));
ok((await q("select count(*)::int c from public.contrato_comunicaciones"))[0].c === 0, "Se borra una comunicación");

seccion("Auditoría");
ok((await q("select count(*)::int c from public.auditoria where tabla in ('procesos','ofertas','contrato_comunicaciones')"))[0].c > 0, "Los cambios quedan en la auditoría");
fin();

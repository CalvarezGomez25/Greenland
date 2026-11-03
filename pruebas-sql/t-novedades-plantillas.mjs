// Aliados, capa 4 (migración 0029): novedades de campo con foto, su revisión y las plantillas de documentos.
import { asignarInterventor, nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"), G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"),
  S = await usuario("s@x.co"), I = await usuario("i@x.co"), C = await usuario("c@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P1, S, "supervisor"], [P2, G2, "gerente"], [P1, I, "interventoria"], [P1, C, "consulta"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const T = (await como(G, () => q("insert into public.terceros (nit, razon_social) values ('901.519.601-4','Contratista Ejemplo') returning id")))[0].id;
const CT = (await como(G, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [P1, JSON.stringify({ tipo: "obra", objeto: "Obra civil", valor: "100000000", tercero_id: T })])))[0].id;
await como(D, () => q("select public.contrato_aprobar($1::uuid)", [CT]));

seccion("Parámetros y depósitos");
for (const k of ["minuta_penal_pct", "minuta_multa_dia_pct", "minuta_confid_smmlv", "minuta_confid_anios", "minuta_liquidacion_meses", "minuta_aviso_terminacion_dias", "minuta_inicio_dias", "minuta_suspension_dias", "minuta_subsanar_dias"])
  ok((await q("select count(*)::int c from public.parametros where clave=$1 and ambito='global'", [k]))[0].c === 1, `Parámetro ${k}`);
ok((await q("select count(*)::int c from storage.buckets where id in ('novedades','plantillas') and public = false"))[0].c === 2, "Dos depósitos privados: novedades y plantillas");

seccion("Fotos (depósito novedades)");
const subir = (u, bucket, nombre) => como(u, () => q("insert into storage.objects (bucket_id, name, owner) values ($1,$2,$3)", [bucket, nombre, u]));
const N1 = "11111111-1111-4111-8111-111111111111";
await asignarInterventor(q, P1, I); // la interventoría solo registra si tiene un contrato vigilado asignado
await subir(S, "novedades", `${P1}/${N1}/foto1.jpg`);
await subir(I, "novedades", `${P1}/${N1}/foto2.jpg`);
await esperaError("Quien no es del proyecto no sube", subir(G2, "novedades", `${P1}/${N1}/foto3.jpg`), /row-level security|permission/);
await esperaError("Consulta no sube", subir(C, "novedades", `${P1}/${N1}/foto3.jpg`), /row-level security|permission/);
ok((await como(G, () => q("select count(*)::int c from storage.objects where bucket_id='novedades'")))[0].c === 2, "La gerencia ve las fotos del proyecto");
ok((await como(I, () => q("select count(*)::int c from storage.objects where bucket_id='novedades'")))[0].c === 1, "La interventoría ve solo la que subió");
ok((await como(G2, () => q("select count(*)::int c from storage.objects where bucket_id='novedades'")))[0].c === 0, "Otro proyecto no ve nada");

seccion("Registrar novedades");
const crear = (u, id, d, fotos = [], proyecto = P1, contrato = CT) => como(u, () => q("select public.novedad_crear($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::jsonb)", [id, proyecto, contrato, JSON.stringify(d), JSON.stringify(fotos)]));
await crear(S, N1, { tipo: "acta_inicio", fecha: "2026-10-20", descripcion: "Se firmó el acta de inicio en obra" }, [`${P1}/${N1}/foto1.jpg`]);
ok((await q("select estado, tipo, cardinality(fotos) f from public.contrato_novedades where id=$1", [N1]))[0].f === 1, "La supervisión registra una novedad con su foto");
const nid = (n) => `22222222-2222-4222-8222-22222222222${n}`;
await crear(I, nid(1), { tipo: "comunicacion", fecha: "2026-10-21", descripcion: "Visita de interventoría" });
await esperaError("Consulta no registra", crear(C, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "x" }), /permiso/);
await esperaError("Otro proyecto no registra", crear(G2, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "x" }), /permiso/);
await esperaError("La descripción es obligatoria", crear(S, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "" }), /Describe/);
await esperaError("Fecha futura", crear(S, nid(2), { tipo: "otro", fecha: "2099-01-01", descripcion: "x" }), /futura/);
await esperaError("Fecha mal escrita", crear(S, nid(2), { tipo: "otro", fecha: "ayer", descripcion: "x" }), /no es válida/);
await esperaError("Tipo desconocido", crear(S, nid(2), { tipo: "magia", fecha: "2026-10-21", descripcion: "x" }), /no es válido/);
await esperaError("Más de 3 fotos", crear(S, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "x" }, ["a", "b", "c", "d"]), /Máximo 3/);
await esperaError("Una foto con ruta ajena", crear(S, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "x" }, [`${P2}/${nid(2)}/f.jpg`]), /ruta esperada/);
await esperaError("Contrato de otro proyecto", crear(S, nid(2), { tipo: "otro", fecha: "2026-10-21", descripcion: "x" }, [], P1, "00000000-0000-0000-0000-000000000000"), /no existe/);
ok((await como(S, () => q("select count(*)::int c from public.contrato_novedades")))[0].c === 2, "La supervisión ve las novedades del proyecto");
ok((await como(I, () => q("select count(*)::int c from public.contrato_novedades")))[0].c === 1, "La interventoría ve solo la suya");
ok((await como(G2, () => q("select count(*)::int c from public.contrato_novedades")))[0].c === 0, "Otro proyecto no ve novedades");

seccion("Revisar y aplicar");
const rev = (u, id, accion, nota = null) => como(u, () => q("select public.novedad_revisar($1::uuid,$2::text,$3::text)", [id, accion, nota]));
await esperaError("La supervisión no revisa", rev(S, N1, "aplicar"), /gerencia/);
await esperaError("Descartar exige motivo", rev(G, N1, "descartar"), /por qué/);
await esperaError("Acción desconocida", rev(G, N1, "borrar"), /no válida/);
await rev(G, N1, "aplicar", "Confirmado con el acta");
ok((await q("select fecha_acta_inicio::text f from public.contratos where id=$1", [CT]))[0].f === "2026-10-20", "Aplicar un acta de inicio fija la fecha en el contrato");
ok((await q("select estado, revisada_por from public.contrato_novedades where id=$1", [N1]))[0].estado === "aplicada", "La novedad queda aplicada");
await esperaError("No se revisa dos veces", rev(G, N1, "aplicar"), /ya fue revisada/);
await crear(S, nid(3), { tipo: "acta_inicio", fecha: "2026-10-25", descripcion: "Otra acta" });
await esperaError("El acta de inicio no se sobrescribe", rev(G, nid(3), "aplicar"), /ya tiene fecha de acta/);
await rev(G, nid(3), "descartar", "Era la misma acta");
ok((await q("select estado from public.contrato_novedades where id=$1", [nid(3)]))[0].estado === "descartada", "Se descarta con su motivo");
await crear(S, nid(4), { tipo: "suspension", fecha: "2026-10-28", descripcion: "Suspensión por lluvias" });
await rev(G, nid(4), "aplicar");
let c = (await q("select suspendido_desde::text s from public.contratos where id=$1", [CT]))[0];
ok(c.s === "2026-10-28", "Aplicar una suspensión la registra como modificación firmada y suspende el contrato");
ok((await q("select count(*)::int c from public.contrato_modificaciones where contrato_id=$1 and tipo='suspension' and estado='firmada'", [CT]))[0].c === 1, "Queda la modificación firmada");
await crear(S, nid(5), { tipo: "reinicio", fecha: "2026-11-01", descripcion: "Reinicio de obras" });
await rev(G, nid(5), "aplicar");
ok((await q("select suspendido_desde from public.contratos where id=$1", [CT]))[0].suspendido_desde === null, "El reinicio levanta la suspensión");
await rev(G, nid(1), "aplicar", "Anotado en comunicaciones");
ok((await q("select estado from public.contrato_novedades where id=$1", [nid(1)]))[0].estado === "aplicada", "Las demás novedades se marcan aplicadas (el registro es manual)");

seccion("Plantillas");
const pl = (u, nombre, archivo) => como(u, () => q("insert into public.plantillas_documento (nombre, ambito, archivo, tamano, campos) values ($1,'contrato',$2,1000,array['OBJETO']) returning id", [nombre, archivo]));
await pl(A, "Minuta de ejemplo", "minuta-ejemplo-2026.docx");
await pl(D, "Acta de ejemplo", "acta-ejemplo-2026.docx");
await esperaError("El gerente no sube plantillas", pl(G, "x", "otra-plantilla.docx"), /row-level security|permission/);
ok((await como(G, () => q("select count(*)::int c from public.plantillas_documento")))[0].c === 2, "El gerente ve las plantillas");
ok((await como(S, () => q("select count(*)::int c from public.plantillas_documento")))[0].c === 0, "La supervisión no las ve");
await esperaError("Nombre de archivo repetido", pl(A, "Otra", "minuta-ejemplo-2026.docx"), /unique|duplicate|23505/);
await subir(A, "plantillas", "minuta-ejemplo-2026.docx");
await esperaError("El gerente no sube al depósito de plantillas", subir(G, "plantillas", "x-2026.docx"), /row-level security|permission/);
ok((await como(G, () => q("select count(*)::int c from storage.objects where bucket_id='plantillas'")))[0].c === 1, "El gerente lee el archivo de la plantilla");
ok((await como(S, () => q("select count(*)::int c from storage.objects where bucket_id='plantillas'")))[0].c === 0, "La supervisión no lo lee");

seccion("Auditoría");
ok((await q("select count(*)::int c from public.auditoria where tabla in ('contrato_novedades','plantillas_documento')"))[0].c > 0, "Los cambios quedan en la auditoría");
fin();

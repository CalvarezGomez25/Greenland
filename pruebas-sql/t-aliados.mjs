// Aliados y proveedores, contratantes y datos contractuales (migración 0026, capa 1 del paquete RAÍZ).
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"), AN = await usuario("an@x.co", "analista_pmo"),
  F = await usuario("f@x.co", "finanzas"), G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co"), I = await usuario("i@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P1, S, "supervisor"], [P2, G2, "gerente"], [P1, I, "interventoria"]])
  await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const nuevoTercero = (u, nit, nombre, extra = "'contratista'") => como(u, () => q(`insert into public.terceros (nit, razon_social, tipo_tercero) values ($1,$2,${extra}) returning id`, [nit, nombre]));

seccion("NIT: normalización y dígito de verificación");
const norm = async (t) => (await q("select public.nit_normalizar($1) as n", [t]))[0].n;
ok((await norm(" 901.519.601-4 ")) === "901519601-4", "Quita puntos y espacios");
ok((await norm("71.935.351")) === "71935351", "Una cédula sin dígito se acepta tal cual");
ok((await norm("pend-amezquita")) === "PEND-AMEZQUITA", "El identificador temporal queda en mayúsculas");
ok((await q("select public.nit_digito('901519601') as d"))[0].d === 4, "Dígito de verificación de 901519601 = 4");
await esperaError("Dígito de verificación incorrecto", q("select public.nit_normalizar('901.519.601-5')"), /dígito de verificación/);
await esperaError("NIT con letras", q("select public.nit_normalizar('ABC123')"), /no es válido/);
await esperaError("NIT vacío", q("select public.nit_normalizar('')"), /no es válido/);

seccion("Terceros: quién ve y quién edita");
const T1 = (await nuevoTercero(G, "901.519.601-4", "Máxima Construcciones S.A.S."))[0].id;
ok((await q("select nit from public.terceros where id=$1", [T1]))[0].nit === "901519601-4", "El NIT queda normalizado en la tabla");
await nuevoTercero(D, "PEND-JDO", "JDO Ingeniería", "'proveedor'");
await nuevoTercero(A, "900.650.395-7", "Entre Arroyos S.A.S.");
await esperaError("El supervisor no crea terceros", nuevoTercero(S, "800.197.268-4", "Otro S.A.S."), /row-level security|permission/);
await esperaError("El analista PMO no crea terceros (solo lee)", nuevoTercero(AN, "800.197.268-4", "Otro S.A.S."), /row-level security|permission/);
await esperaError("NIT repetido (aunque venga con puntos)", nuevoTercero(G2, "901519601-4", "Duplicado"), /23505|duplicate|unique/);
for (const [n, u] of [["administrador", A], ["director", D], ["analista", AN], ["finanzas", F], ["gerente", G], ["gerente de otro proyecto", G2]])
  ok((await como(u, () => q("select count(*)::int c from public.terceros")))[0].c === 3, `${n} ve los 3 terceros`);
for (const [n, u] of [["supervisor", S], ["interventoría", I]])
  ok((await como(u, () => q("select count(*)::int c from public.terceros")))[0].c === 0, `${n} no ve terceros`);
await como(G, () => q("update public.terceros set nit='900123456-8', observaciones='RUT recibido' where nit='PEND-JDO'"));
ok((await q("select count(*)::int c from public.terceros where nit='PEND-JDO'"))[0].c === 0, "Un PEND- se reemplaza por el NIT real al llegar el RUT");
await esperaError("Nadie borra terceros", como(A, () => q("delete from public.terceros where id=$1", [T1])), /permission/);
await como(G, () => q("update public.terceros set estado='inactivo' where nit='900123456-8'"));
ok((await q("select estado from public.terceros where nit='900123456-8'"))[0].estado === "inactivo", "Se desactiva en lugar de borrar");
await esperaError("Correo con formato inválido", como(G, () => q("update public.terceros set correo_notificacion='no-es-correo' where id=$1", [T1])), /check|violates/);

seccion("Contratantes y contratante del proyecto");
const ins = (u, nombre, nit) => como(u, () => q("insert into public.contratantes (razon_social, nit) values ($1,$2) returning id, codigo", [nombre, nit]));
const [c1] = await ins(A, "EL SILENCIO GL S.A.S.", "901.902.573-8");
const [c2] = await ins(D, "GREENLIME S.A.S.", "901.720.469-8");
ok(c1.codigo === "CT-01" && c2.codigo === "CT-02", `Códigos consecutivos: ${c1.codigo}, ${c2.codigo}`);
await esperaError("El gerente no crea contratantes", ins(G, "OTRA S.A.S.", null), /row-level security|permission/);
await esperaError("Razón social repetida sin importar mayúsculas", ins(A, "el silencio gl s.a.s.", null), /23505|duplicate|unique/);
await como(A, () => q("update public.contratantes set codigo='CT-99' where id=$1", [c1.id]));
ok((await q("select codigo from public.contratantes where id=$1", [c1.id]))[0].codigo === "CT-01", "El código del contratante no se puede cambiar");
await como(G, () => q("select public.proyecto_contratante_asignar($1::uuid,$2::uuid)", [P1, c1.id]));
ok((await q("select contratante_id from public.proyectos where id=$1", [P1]))[0].contratante_id === c1.id, "El gerente asigna el contratante a su proyecto");
await esperaError("El gerente de otro proyecto no puede", como(G2, () => q("select public.proyecto_contratante_asignar($1::uuid,$2::uuid)", [P1, c2.id])), /permiso/);
await esperaError("El supervisor no puede", como(S, () => q("select public.proyecto_contratante_asignar($1::uuid,$2::uuid)", [P1, c2.id])), /permiso/);
await esperaError("No se borra un contratante en uso", como(A, () => q("delete from public.contratantes where id=$1", [c1.id])), /permission/);

seccion("Contratos ligados a un tercero");
const crear = (u, p, datos) => como(u, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [p, JSON.stringify({ tipo: "obra", objeto: "Obra civil", valor: "50000000", ...datos })])).then((r) => r[0].id);
const C1 = await crear(G, P1, { tercero_id: T1 });
let c = (await q("select contratista, tercero_id, etapa, estado_aprobacion from public.contratos where id=$1", [C1]))[0];
ok(c.contratista === "Máxima Construcciones S.A.S." && c.tercero_id === T1, "El contratista toma el nombre del tercero");
ok(c.etapa === 3 && c.estado_aprobacion === "pendiente", "Un contrato pendiente de aprobación nace en la etapa 3");
await como(D, () => q("select public.contrato_aprobar($1::uuid)", [C1]));
ok((await q("select etapa from public.contratos where id=$1", [C1]))[0].etapa === 4, "Al aprobarlo pasa a la etapa 4 (firmas)");
await esperaError("Un tercero inactivo no sirve para un contrato", crear(G, P1, { tercero_id: (await q("select id from public.terceros where nit='900123456-8'"))[0].id }), /inactivo/);
await esperaError("Sin tercero ni nombre no hay contrato", crear(G, P1, { contratista: "" }), /obligatorio|contratista/);
const CT = await crear(G, P1, { contratista: "Constructor sin registrar" });
ok((await q("select tercero_id from public.contratos where id=$1", [CT]))[0].tercero_id === null, "Sigue siendo posible un contratista sin tercero (contratos anteriores)");
await como(G, () => q("select public.contrato_actualizar($1::uuid,$2::jsonb)", [CT, JSON.stringify({ tipo: "obra", objeto: "Obra civil", valor: "50000000", tercero_id: T1 })]));
ok((await q("select contratista from public.contratos where id=$1", [CT]))[0].contratista === "Máxima Construcciones S.A.S.", "Se liga un contrato antiguo a un tercero");
await como(G, () => q("select public.contrato_actualizar($1::uuid,$2::jsonb)", [CT, JSON.stringify({ tipo: "obra", objeto: "Obra civil ajustada", valor: "50000000", contratista: "Texto ignorado" })]));
ok((await q("select contratista from public.contratos where id=$1", [CT]))[0].contratista === "Máxima Construcciones S.A.S.", "Con tercero, el nombre del contratista sigue al tercero");

seccion("Datos contractuales y fecha fin");
const datos = (u, id, d) => como(u, () => q("select public.contrato_datos_guardar($1::uuid,$2::jsonb)", [id, JSON.stringify(d)]));
await datos(G, C1, { fecha_firma: "2026-05-01", fecha_acta_inicio: "2026-05-04", plazo_valor: "30", plazo_unidad: "dias_calendario", consecutivo: "20260501-1", orden_servicio_sap: "OS-123" });
let d = (await q("select fecha_fin_inicial::text f, consecutivo, orden_servicio_sap from public.contratos where id=$1", [C1]))[0];
ok(d.f === "2026-06-03" && d.consecutivo === "20260501-1" && d.orden_servicio_sap === "OS-123", `Fin = inicio + 30 días calendario: ${d.f}`);
await datos(G, C1, { fecha_firma: "2026-05-01", fecha_acta_inicio: "2026-05-04", plazo_valor: "10", plazo_unidad: "dias_habiles" });
const festivo = (await q("select count(*)::int c from public.festivos where fecha='2026-05-18'"))[0].c;
ok(festivo === 1 && (await q("select fecha_fin_inicial::text f from public.contratos where id=$1", [C1]))[0].f === "2026-05-19", "Fin con 10 días hábiles: salta el festivo del 18 de mayo (Ascensión) y termina el 19");
await datos(G, C1, { fecha_firma: "2026-05-01", fecha_acta_inicio: "2026-05-04", plazo_valor: "3", plazo_unidad: "meses" });
ok((await q("select fecha_fin_inicial::text f from public.contratos where id=$1", [C1]))[0].f === "2026-08-04", "Fin con 3 meses");
await datos(G, C1, { fecha_firma: "2026-05-01", plazo_valor: "3", plazo_unidad: "meses" });
ok((await q("select fecha_fin_inicial from public.contratos where id=$1", [C1]))[0].fecha_fin_inicial === null, "Sin acta de inicio no hay fecha fin");
await esperaError("Plazo sin unidad", datos(G, C1, { plazo_valor: "3" }), /unidad/);
await esperaError("Acta de inicio anterior a la firma", datos(G, C1, { fecha_firma: "2026-05-10", fecha_acta_inicio: "2026-05-01" }), /anterior/);
await esperaError("Fecha mal escrita", datos(G, C1, { fecha_firma: "ayer" }), /válid/);
await esperaError("El supervisor no edita datos contractuales", datos(S, C1, { consecutivo: "x" }), /permiso/);
await esperaError("El gerente de otro proyecto tampoco", datos(G2, C1, { consecutivo: "x" }), /permiso/);

seccion("Etapa del contrato");
const etapa = (u, id, e, m = null) => como(u, () => q("select public.contrato_etapa_cambiar($1::uuid,$2::int,$3::text)", [id, e, m]));
await etapa(G, C1, 5);
ok((await q("select etapa, fecha_etapa is not null f from public.contratos where id=$1", [C1]))[0].etapa === 5, "Se avanza de la etapa 4 a la 5");
await esperaError("No se salta una etapa", etapa(G, C1, 7), /de una en una/);
await esperaError("Devolverse exige motivo", etapa(G, C1, 4), /motivo/);
await etapa(G, C1, 4, "Faltaba el documento de firma");
ok((await q("select count(*)::int c from public.contrato_etapa_historial where contrato_id=$1 and motivo is not null", [C1]))[0].c === 1, "La devolución queda en el historial con su motivo");
await etapa(G, C1, 5); await etapa(G, C1, 6); await etapa(G, C1, 7);
await esperaError("No se archiva desde la etapa 7", etapa(G, C1, 9), /de una en una|etapa 8/);
await etapa(G, C1, 8); await etapa(G, C1, 9);
ok((await q("select etapa from public.contratos where id=$1", [C1]))[0].etapa === 9, "Se archiva desde la etapa 8");
const CP = await crear(G, P1, { contratista: "Pendiente S.A.S." });
await esperaError("Un contrato sin aprobar no pasa de la etapa 3", etapa(G, CP, 4), /no está aprobado/);
await esperaError("El supervisor no cambia etapas", etapa(S, C1, 8, "x"), /permiso/);
ok((await como(G, () => q("select count(*)::int c from public.contrato_etapa_historial where contrato_id=$1", [C1])))[0].c === 7, "El gerente ve el historial de etapas del contrato");
ok((await como(I, () => q("select count(*)::int c from public.contrato_etapa_historial")))[0].c === 0, "La interventoría no ve historiales de contratos que no le asignaron");

seccion("Parámetros");
for (const k of ["smmlv_cop", "tope_asamblea_smmlv", "alerta_ambar_dias", "etapa_dias_max_1", "etapa_dias_max_5", "etapa_dias_max_7"])
  ok((await q("select valor from public.parametros where ambito='global' and clave=$1", [k])).length === 1, `Parámetro ${k}`);
ok((await q("select valor from public.parametros where clave='tope_asamblea_smmlv'"))[0].valor === "600", "El tope es 600 SMMLV");

seccion("Auditoría");
ok((await q("select count(*)::int c from public.auditoria where tabla='terceros'"))[0].c > 0, "Los cambios en terceros quedan en la auditoría");
fin();

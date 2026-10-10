import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"), AN = await usuario("an@x.co", "analista_pmo"),
  G = await usuario("g@x.co"), PA = await usuario("pa@x.co"), S = await usuario("s@x.co"), G2 = await usuario("g2@x.co");
const P1 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 1','2026-01-01',12) returning id")))[0].id;
const P2 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 2','2026-01-01',12) returning id")))[0].id;
for (const [u, r] of [[G, "gerente"], [PA, "patrocinador"], [S, "supervisor"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [P1, u, r]));
await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,'gerente')", [P2, G2]));
const J = (o) => JSON.stringify({ tipo: "Costo", descripcion_despues: "Después", justificacion: "Porque sí", ...o });
const crear = (u, p, o = {}) => como(u, () => q("select public.cambio_crear($1::uuid,$2::jsonb) as id", [p, J(o)])).then((r) => r[0].id);
const fn = (u, nombre, ...args) => como(u, () => q(`select public.${nombre}(${args.map((_, i) => "$" + (i + 1)).join(",")})`, args));
const info = async (id) => (await q("select codigo, nivel, variacion_pct::text pct, requiere_firma_patrocinador firma, estado_flujo e, base_valor::text base from public.cambios where id=$1", [id]))[0];

seccion("Sin línea base no se puede calcular el nivel");
const sinBase = await crear(G, P1, { impacto_costo: "8000000" });
ok((await info(sinBase)).nivel === null, "Con impacto en costo y sin BAC, el nivel queda sin calcular");
await esperaError("No se radica sin nivel", fn(G, "cambio_avanzar", sinBase, null), /línea base/);
await como(G, () => q("select public.cambio_actualizar($1::uuid,$2::jsonb)", [sinBase, J({ impacto_costo: "0" })]));
ok((await info(sinBase)).nivel === "menor", "Sin impacto en costo el nivel es Menor");

// Base: contrato de 480.000.000 (caso 13.8) → se modela como BAC del proyecto
await como(G, () => q("select public.medicion_guardar($1::uuid,'2026-03-31'::date,480000000,100000000,90000000,95000000)", [P1]));

seccion("Caso 13.8: niveles sobre 480.000.000");
const c1 = await crear(G, P1, { impacto_costo: "8000000" });
const c2 = await crear(G, P1, { impacto_costo: "12000000" });
const c3 = await crear(G, P1, { impacto_costo: "30000000" });
const c0 = await crear(G, P1, { impacto_costo: "9600000" });
const cn = await crear(G, P1, { impacto_costo: "-30000000" });
const i1 = await info(c1), i2 = await info(c2), i3 = await info(c3);
ok(i1.nivel === "menor" && i1.pct === "1.6667" && !i1.firma, "8.000.000 → 1,67 % Menor, sin firma");
ok(i2.nivel === "moderado" && i2.pct === "2.5000" && !i2.firma, "12.000.000 → 2,50 % Moderado, sin firma");
ok(i3.nivel === "critico" && i3.pct === "6.2500" && i3.firma, "30.000.000 → 6,25 % Crítico, con firma del patrocinador");
ok((await info(c0)).nivel === "menor", "9.600.000 es exactamente 2 %: Menor (frontera inclusiva)");
ok((await info(cn)).nivel === "critico", "Un ahorro de 30.000.000 también se mide en valor absoluto");
const anio = new Date().getFullYear();
ok(i1.codigo === `CC-${anio}-004` || /^CC-\d{4}-\d{3}$/.test(i1.codigo), `Código con formato CC-AAAA-NNN (${i1.codigo})`);
const codigos = (await q("select codigo from public.cambios where proyecto_id=$1 order by codigo", [P1])).map(r => r.codigo);
ok(new Set(codigos).size === codigos.length, "Los códigos no se repiten");

seccion("Flujo y permisos");
await esperaError("Supervisor no registra cambios", crear(S, P1), /permiso/);
await esperaError("Gerente de otro proyecto no registra en P1", crear(G2, P1), /permiso/);
await fn(G, "cambio_avanzar", c1, "Radicado al PMO");
await esperaError("Supervisor no avanza", fn(S, "cambio_avanzar", c1, null), /permiso|Solo/);
await fn(AN, "cambio_avanzar", c1, null);                      // → evaluación
await fn(AN, "cambio_avanzar", c1, null);                      // → análisis
await esperaError("El gerente no puede avanzar identificado de otro nivel? (ok) pero no decidir aún", fn(G, "cambio_decidir", c1, "aprobar", null), /no está en la fase/);
await fn(AN, "cambio_avanzar", c1, null);                      // → aprobación
ok((await info(c1)).e === "aprobacion", "Llega a aprobación");
await esperaError("En aprobación 'avanzar' no sirve", fn(G, "cambio_avanzar", c1, null), /aprueba o se rechaza/);

seccion("Aprobación por nivel (menor: gerente; moderado y crítico: director)");
await esperaError("Analista no aprueba", fn(AN, "cambio_decidir", c1, "aprobar", null), /nivel menor/);
await esperaError("Administrador no aprueba por defecto", fn(A, "cambio_decidir", c1, "aprobar", null), /nivel menor/);
await esperaError("El director no aprueba un cambio menor (lo aprueba el gerente)", fn(D, "cambio_decidir", c1, "aprobar", null), /nivel menor/);
await fn(G, "cambio_decidir", c1, "aprobar", "Aprobado");
const a1 = (await q("select estado_flujo e, aprobador_id, fecha_aprobacion from public.cambios where id=$1", [c1]))[0];
ok(a1.e === "aprobado" && a1.aprobador_id === G && a1.fecha_aprobacion, "Gerente aprueba el menor; queda aprobador y fecha");
const lb = await q("select tipo, version, bac::text from public.lineas_base where proyecto_id=$1", [P1]);
ok(lb.length === 1 && lb[0].tipo === "costo" && lb[0].bac === "488000000.00", "Aprobar crea línea base de costo v1: 480.000.000 + 8.000.000");

const avanzaHastaAprobacion = async (id) => { await fn(G, "cambio_avanzar", id, null); await fn(AN, "cambio_avanzar", id, null); await fn(AN, "cambio_avanzar", id, null); await fn(AN, "cambio_avanzar", id, null); };
await avanzaHastaAprobacion(c2);
await esperaError("El gerente no aprueba un moderado", fn(G, "cambio_decidir", c2, "aprobar", null), /nivel moderado/);
await fn(D, "cambio_decidir", c2, "aprobar", null);
ok((await q("select max(version)::int v, max(bac)::text b from public.lineas_base where proyecto_id=$1 and tipo='costo'", [P1]))[0].b === "500000000.00", "Línea base v2: 488.000.000 + 12.000.000");

await avanzaHastaAprobacion(c3);
await esperaError("Crítico >5 % exige firma del patrocinador antes de aprobar", fn(D, "cambio_decidir", c3, "aprobar", null), /firma del patrocinador/);
await esperaError("El gerente no firma por el patrocinador", fn(G, "cambio_firmar_patrocinador", c3), /patrocinador/);
await fn(PA, "cambio_firmar_patrocinador", c3);
await esperaError("El director no puede firmar", fn(D, "cambio_firmar_patrocinador", c3), /patrocinador/);
await fn(D, "cambio_decidir", c3, "aprobar", null);
ok((await info(c3)).e === "aprobado", "Con firma, el director aprueba el crítico");
ok((await q("select max(bac)::text b from public.lineas_base where proyecto_id=$1 and tipo='costo'", [P1]))[0].b === "530000000.00", "Línea base v3: 500.000.000 + 30.000.000");
await esperaError("Una firma no se registra en un cambio que no la requiere", (async () => { await avanzaHastaAprobacion(c1.length ? await crear(G, P1, { impacto_costo: "1000" }) : c1); })().then(()=>fn(PA, "cambio_firmar_patrocinador", c1)), /./);

seccion("Rechazo, devolución, plazo en contrato, cierre");
const cr = await crear(G, P1, { impacto_costo: "5000" }); await avanzaHastaAprobacion(cr);
await esperaError("Rechazar exige motivo", fn(G, "cambio_decidir", cr, "rechazar", ""), /motivo/);
await fn(G, "cambio_decidir", cr, "rechazar", "No procede");
ok((await info(cr)).e === "rechazado", "Rechazado");
await fn(G, "cambio_avanzar", cr, null);
ok((await info(cr)).e === "cerrado", "Rechazado → cerrado");
await esperaError("Un cambio cerrado no se edita", fn(G, "cambio_actualizar", cr, J({})), /cerrado/);
const cd = await crear(G, P1, { impacto_costo: "5000" }); await avanzaHastaAprobacion(cd);
await esperaError("Devolver exige motivo", fn(AN, "cambio_devolver", cd, ""), /motivo/);
await fn(AN, "cambio_devolver", cd, "Falta el análisis financiero");
ok((await info(cd)).e === "analisis_impacto", "Devuelto a análisis de impacto");
const h = await q("select a_estado, nota from public.cambios_historial where cambio_id=$1 order by id", [cd]);
ok(h.length >= 6 && h[h.length - 1].nota.includes("Devuelto"), "El historial registra cada paso");
await esperaError("Tras aprobación no se cambian los impactos", (async () => { await fn(G, "cambio_actualizar", c1, J({ impacto_costo: "999999999" })); const r = await q("select impacto_costo::text i from public.cambios where id=$1", [c1]); if (r[0].i === "8000000.00") throw new Error("sin cambio"); })(), /sin cambio/);
await fn(G, "cambio_avanzar", c1, null); await fn(G, "cambio_avanzar", c1, null);
ok((await info(c1)).e === "cerrado", "Aprobado → implementación → cerrado");

seccion("Visibilidad y escritura directa");
ok((await como(S, () => q("select * from public.cambios"))).length > 0, "Supervisor ve los cambios de su obra");
ok((await como(G2, () => q("select * from public.cambios where proyecto_id=$1", [P1]))).length === 0, "Otro gerente no los ve");
ok((await como(D, () => q("select * from public.lineas_base"))).length === 3, "Director ve las líneas base");
await esperaError("Escritura directa prohibida", como(G, () => q("update public.cambios set nivel='menor'")), /permission denied/);
await esperaError("Líneas base solo por aprobación", como(G, () => q("insert into public.lineas_base (proyecto_id,tipo,version,bac) values ($1,'costo',9,1)", [P1])), /permission denied/);
ok((await q("select count(*)::int n from public.auditoria where tabla='lineas_base'"))[0].n === 3, "Las líneas base quedan auditadas");

seccion("Contrato con cambio de plazo → Crítico; cronograma versionado");
const CT = await como(G, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [P1, JSON.stringify({ tipo: "obra", contratista: "Constructora X", objeto: "Obra", valor: "480000000" })])).then(r => r[0].id);
const cp = await crear(G, P1, { impacto_costo: "0", impacto_dias: "30", contrato_id: CT });
ok((await info(cp)).nivel === "critico", "Cambio de plazo ligado a un contrato es Crítico");
const cs = await crear(G, P1, { impacto_costo: "1000", impacto_dias: "10" });
ok((await info(cs)).nivel === "menor", "Cambio de plazo sin contrato no fuerza Crítico");
await avanzaHastaAprobacion(cs); await fn(G, "cambio_decidir", cs, "aprobar", null);
const cr2 = (await q("select fecha_fin::text f from public.lineas_base where proyecto_id=$1 and tipo='cronograma'", [P1]))[0];
ok(cr2.f === "2027-01-11", "Línea base de cronograma: fin 2027-01-01 + 10 días");

seccion("Parámetros: el administrador puede aprobar si se activa");
await como(A, () => q("select public.parametro_guardar('global', null, 'cambio_admin_puede_aprobar', 'si')"));
const ca = await crear(G, P1, { impacto_costo: "1000" }); await avanzaHastaAprobacion(ca);
await fn(A, "cambio_decidir", ca, "aprobar", null);
ok((await info(ca)).e === "aprobado", "Con el parámetro en 'si' el administrador aprueba");
fin();

// Registro de riesgos ampliado e importación (migración 0021).
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), S = await usuario("s@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Planta"), P2 = await proy("Otra");
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, S, "supervisor"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));

const fila = (codigo, extra = {}) => ({ codigo, categoria: "Contractual", descripcion: "Riesgo " + codigo, probabilidad: 4, impacto: 4, frente: "F1", estado: "activo", ...extra });
const imp = (u, p, filas) => como(u, () => q("select public.riesgos_importar($1::uuid, $2::jsonb) as r", [p, JSON.stringify(filas)])).then((x) => x[0].r);

seccion("Carga y datos nuevos");
let r = await imp(G, P1, [fila("T-01", { causa: "c", consecuencia: "k", momento_control: "Precontractual", fecha_objetivo: "2026-11-30", referencia: "ref", plan_accion: "plan", responsable: "Jurídica" }), fila("F1-01", { probabilidad: 1, impacto: 2 })]);
ok(r.creados === 2 && r.actualizados === 0, `Crea 2 riesgos → ${JSON.stringify(r)}`);
const t1 = (await q("select * from public.riesgos where proyecto_id=$1 and codigo='T-01'", [P1]))[0];
ok(t1.score === 16 && t1.frente === "F1" && t1.causa === "c" && t1.momento_control === "Precontractual" && String(t1.fecha_objetivo).startsWith("2026-11-30") || t1.fecha_objetivo?.toISOString?.().startsWith("2026-11-30"), "Guarda código propio, score 16 y los campos nuevos");
ok((await q("select codigo from public.riesgos where proyecto_id=$1 order by codigo", [P1])).map((x) => x.codigo).join() === "F1-01,T-01", "Conserva los códigos del archivo");

seccion("Repetir actualiza, no duplica");
r = await imp(G, P1, [fila("T-01", { descripcion: "Texto nuevo" }), fila("F1-02")]);
ok(r.creados === 1 && r.actualizados === 1, `1 creado y 1 actualizado → ${JSON.stringify(r)}`);
ok((await q("select count(*)::int n from public.riesgos where proyecto_id=$1", [P1]))[0].n === 3, "Quedan 3 riesgos en total");
ok((await q("select descripcion from public.riesgos where codigo='T-01' and proyecto_id=$1", [P1]))[0].descripcion === "Texto nuevo", "El texto se actualizó");

seccion("Riesgos creados a mano siguen con su consecutivo");
const manual = (await como(G, () => q("insert into public.riesgos (proyecto_id, categoria, descripcion, probabilidad, impacto) values ($1,'Técnico','Manual',2,2) returning codigo", [P1])))[0];
ok(/^R\d\d$/.test(manual.codigo), `Código automático ${manual.codigo}`);

seccion("Auditoría");
ok((await q("select count(*)::int n from public.auditoria where tabla='riesgos' and campo='(alta)' and proyecto_id=$1", [P1]))[0].n >= 3, "Cada riesgo importado queda auditado (alta)");
ok((await q("select count(*)::int n from public.auditoria where tabla='riesgos' and campo='descripcion' and valor_nuevo='Texto nuevo'"))[0].n === 1, "Y el cambio de texto al reimportar también");

seccion("Permisos y validaciones");
await esperaError("El supervisor no importa", imp(S, P1, [fila("X-1")]), /permiso/);
await esperaError("Otro gerente tampoco", imp(G2, P1, [fila("X-1")]), /permiso/);
await esperaError("Código repetido", imp(G, P1, [fila("X-1"), fila("X-1")]), /repetido/);
await esperaError("Probabilidad fuera de rango", imp(G, P1, [fila("X-2", { probabilidad: 9 })]), /no es válido/);
await esperaError("Estado inválido", imp(G, P1, [fila("X-3", { estado: "raro" })]), /no es válido/);
await esperaError("Fecha mal escrita", imp(G, P1, [fila("X-4", { fecha_objetivo: "30/11/2026" })]), /AAAA-MM-DD/);
await esperaError("Lista vacía", imp(G, P1, []), /No hay riesgos/);
ok((await q("select count(*)::int n from public.riesgos where codigo like 'X-%'"))[0].n === 0, "Todo o nada: un error no deja riesgos a medias");
fin();

// Destinatarios de las alertas por correo (migración 0019).
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("admin@x.co", "administrador"), G = await usuario("gerente@x.co"), G2 = await usuario("gerente2@x.co"),
  S = await usuario("sup@x.co"), C = await usuario("con@x.co"), AN = await usuario("analista@x.co", "analista_pmo");
const P1 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 1','2026-01-01',12) returning id")))[0].id;
const P2 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 2','2026-01-01',12) returning id")))[0].id;
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, S, "supervisor"], [P1, C, "consulta"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const correos = async (u, p, aud) => (await como(u, () => q("select correo from public.correos_alerta($1::uuid,$2) order by 1", [p, aud]))).map((r) => r.correo);

seccion("Sin director registrado, las decisiones del director van a los administradores");
ok((await correos(G, P1, "director")).join() === "admin@x.co", "director → administrador (no hay director)");
const D = await usuario("director@x.co", "director_general");
seccion("Con director");
ok((await correos(G, P1, "director")).join() === "director@x.co", "director → solo el director general");
ok((await correos(G, P1, "gerente")).join() === "gerente@x.co", "gerente → gerente de ese proyecto");

ok((await correos(G, P1, "ambos")).join() === "director@x.co,gerente@x.co", "ambos → director y gerente, sin repetir");
ok((await correos(D, P2, "gerente")).join() === "gerente2@x.co", "el director puede consultar cualquier proyecto");
ok((await correos(AN, P1, "ambos")).length === 2, "el analista (usuario de las alertas) puede consultar");

seccion("Permisos");
await esperaError("El supervisor no consulta destinatarios", correos(S, P1, "ambos"), /permiso/);
await esperaError("Consulta tampoco", correos(C, P1, "ambos"), /permiso/);
await esperaError("El gerente de otro proyecto no consulta este", correos(G2, P1, "ambos"), /permiso/);
await esperaError("Audiencia inventada se rechaza", correos(G, P1, "todos"), /Audiencia/);
await esperaError("Sin sesión no hay acceso", como(null, () => q("select * from public.correos_alerta($1::uuid,'ambos')", [P1])), /permission denied|permiso/);

seccion("Parámetro de apagado");
ok((await q("select valor from public.parametros where clave='alertas_correo_activas' and ambito='global'"))[0].valor === "si", "Las alertas vienen activas por defecto");
fin();

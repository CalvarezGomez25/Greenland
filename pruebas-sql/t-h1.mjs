import { nuevaBase, ok, seccion, fin, asignarInterventor } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"),
  AN = await usuario("an@x.co", "analista_pmo"), F = await usuario("f@x.co", "finanzas"),
  G = await usuario("g@x.co"), S = await usuario("s@x.co"), I = await usuario("i@x.co"), O = await usuario("o@x.co");
const P1 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 1','2026-01-01',12) returning id")))[0].id;
const P2 = (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ('Obra 2','2026-01-01',6) returning id")))[0].id;
for (const [u, r] of [[G, "gerente"], [S, "supervisor"], [I, "interventoria"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [P1, u, r]));
const veo = (u) => como(u, () => q("select id from public.proyectos").then(r => r.length));

seccion("Visibilidad por rol");
ok(await veo(A) === 2 && await veo(D) === 2 && await veo(AN) === 2 && await veo(F) === 2, "Admin, director, analista y finanzas ven los 2 proyectos");
ok(await veo(G) === 1 && await veo(S) === 1, "Gerente y supervisor ven solo su obra");
ok(await veo(I) === 0, "Interventoría sin asignación vigente NO ve el proyecto");
await asignarInterventor(q, P1, I);
ok(await veo(I) === 1, "Interventoría con asignación ve el proyecto asignado");
ok(await veo(O) === 0, "Persona ajena no ve ninguno");
ok((await como(I, () => q("select * from public.parametros"))).length === 0, "Interventoría NO ve parámetros");
ok((await como(G, () => q("select * from public.parametros"))).length > 25, "Gerente sí ve parámetros");
ok((await como(O, () => q("select * from public.parametros"))).length === 0, "Ajeno no ve parámetros");

seccion("Ficha, código y portafolio");
const [p] = await q("select codigo, tipo, fase, estado, usa_obra, organizacion_id is not null as org, portafolio_id is not null as por from public.proyectos where id = $1", [P1]);
ok(/^GL-\d{3}$/.test(p.codigo) && p.org && p.por && p.estado === "activo" && p.fase === "inicio", `Proyecto nuevo con código ${p.codigo}, organización y portafolio por defecto`);
const ficha = (u, pr, o) => como(u, () => q("select public.proyecto_ficha_guardar($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8)", [pr, o.tipo ?? "obra_civil", o.fase ?? "planificacion", o.estado ?? "activo", true, o.org, o.por, o.codigo ?? null]));
const [{ org, por }] = await q("select organizacion_id org, portafolio_id por from public.proyectos where id = $1", [P1]);
await ficha(G, P1, { org, por, fase: "ejecucion" });
ok((await q("select fase from public.proyectos where id = $1", [P1]))[0].fase === "ejecucion", "Gerente cambia la fase");
await esperaError("Gerente NO cambia el código", ficha(G, P1, { org, por, codigo: "ZZ-9" }), /administrador/);
await ficha(A, P1, { org, por, codigo: "ZZ-9" });
ok((await q("select codigo from public.proyectos where id = $1", [P1]))[0].codigo === "ZZ-9", "Administrador sí cambia el código");
await esperaError("Supervisor NO edita la ficha", ficha(S, P1, { org, por }), /permiso/);
await esperaError("Estado inválido rechazado", ficha(A, P1, { org, por, estado: "raro" }), /no válido/);

seccion("Parámetros");
const par = (u, clave, valor, amb = "global", id = null) => como(u, () => q("select public.parametro_guardar($1,$2::uuid,$3,$4)", [amb, id, clave, valor]));
ok((await q("select public.parametro('spi_verde_min', $1) v", [P1]))[0].v === "0.95", "Valor global vigente");
await par(A, "spi_verde_min", "0.97");
ok((await q("select public.parametro('spi_verde_min', $1) v", [P1]))[0].v === "0.97", "Admin cambia el global");
await par(A, "spi_verde_min", "0.99", "proyecto", P1);
ok((await q("select public.parametro('spi_verde_min', $1) v", [P1]))[0].v === "0.99", "El del proyecto prevalece");
ok((await q("select public.parametro('spi_verde_min', $1) v", [P2]))[0].v === "0.97", "Otro proyecto sigue con el global");
await par(A, "spi_verde_min", "0.96", "portafolio", por);
ok((await q("select public.parametro('spi_verde_min', $1) v", [P2]))[0].v === "0.96", "El del portafolio prevalece sobre el global");
await esperaError("Gerente NO cambia parámetros", par(G, "spi_verde_min", "1"), /administrador/);
await esperaError("Clave inexistente rechazada", par(A, "inventada", "1"), /no existe/);
await esperaError("Número inválido rechazado", par(A, "spi_verde_min", "abc"), /número/);
ok((await q("select count(*)::int n from public.auditoria where tabla = 'parametros'"))[0].n >= 3, "Cambios de parámetros quedan en auditoría");
const au = await q("select usuario_id, valor_anterior, valor_nuevo from public.auditoria where tabla='parametros' and campo='valor' order by id limit 1");
ok(au[0].usuario_id === A && au[0].valor_anterior === "0.95" && au[0].valor_nuevo === "0.97", "Auditoría guarda usuario, valor anterior y nuevo");

seccion("Auditoría y roles globales");
ok((await como(G, () => q("select * from public.auditoria")))[0] === undefined || (await como(G, () => q("select distinct tabla from public.auditoria where proyecto_id is null"))).length === 0, "Gerente no ve auditoría global (solo de su proyecto)");
ok((await como(A, () => q("select * from public.auditoria"))).length > 5, "Administrador ve la auditoría");
ok((await como(D, () => q("select * from public.auditoria"))).length > 5, "Director general ve la auditoría");
ok((await como(S, () => q("select * from public.auditoria"))).length === 0, "Supervisor no ve auditoría");
await como(A, () => q("select public.perfil_asignar_rol_global($1::uuid,'analista_pmo')", [S]));
ok((await q("select rol_global from public.perfiles where id=$1", [S]))[0].rol_global === "analista_pmo", "Administrador asigna rol global");
ok((await q("select count(*)::int n from public.auditoria where tabla='perfiles' and campo='rol_global'"))[0].n >= 1, "Cambio de rol global auditado");
await esperaError("No puede cambiar su propio rol", como(A, () => q("select public.perfil_asignar_rol_global($1::uuid,null)", [A])), /propio rol/);
await esperaError("Gerente no asigna roles", como(G, () => q("select public.perfil_asignar_rol_global($1::uuid,'administrador')", [O])), /administrador/);
await esperaError("Persona no puede subirse el rol directamente", como(G, () => q("update public.perfiles set rol_global='administrador' where id=$1", [G])), /./);
ok((await q("select rol_global from public.perfiles where id=$1", [G]))[0].rol_global === null, "Rol global de G sigue vacío");
await esperaError("Organizaciones: gerente no crea", como(G, () => q("insert into public.organizaciones (nombre) values ('x')")), /row-level|permission/);
fin();

// Correcciones de la auditoría (migración 0017): cada hallazgo queda fijado con una prueba.
import { nuevaBase, ok, seccion, fin } from "./base.mjs";
const { q, como, esperaError, usuario } = await nuevaBase();
const A = await usuario("a@x.co", "administrador"), D = await usuario("d@x.co", "director_general"),
  G = await usuario("g@x.co"), G2 = await usuario("g2@x.co"), C = await usuario("c@x.co"), IT = await usuario("it@x.co");
const proy = async (n) => (await como(A, () => q("insert into public.proyectos (nombre, fecha_inicio, duracion_meses) values ($1,'2026-01-01',12) returning id", [n])))[0].id;
const P1 = await proy("Obra 1"), P2 = await proy("Obra 2");
for (const [p, u, r] of [[P1, G, "gerente"], [P2, G2, "gerente"], [P1, C, "consulta"], [P1, IT, "interventoria"]]) await como(A, () => q("insert into public.miembros_proyecto values ($1,$2,$3)", [p, u, r]));
const J = JSON.stringify;
const contrato = async (u, p, valor) => (await como(u, () => q("select public.contrato_crear($1::uuid,$2::jsonb) as id", [p, J({ tipo: "obra", contratista: "X", objeto: "Obra", valor })])))[0].id;
await como(A, () => q("select public.medicion_guardar($1::uuid, '2026-02-01'::date, 1000000000, 0, 0, 0)", [P1]).catch(() => {}));
await q("insert into public.lineas_base (proyecto_id, tipo, version, bac) values ($1,'costo',1,1000000000), ($2,'costo',1,2000000000)", [P1, P2]);
const CT1 = await contrato(G, P1, "480000000"), CT2 = await contrato(G2, P2, "5000000000");

seccion("1. Un cambio no puede ligarse al contrato de otro proyecto");
await esperaError("El gerente de P1 no puede ligar un cambio al contrato de P2", como(G, () => q("select public.cambio_crear($1::uuid,$2::jsonb)", [P1, J({ tipo: "Costo", descripcion_despues: "x", justificacion: "x", impacto_costo: "1000", contrato_id: CT2 })])), /no es de este proyecto/);
const cam = (await como(G, () => q("select public.cambio_crear($1::uuid,$2::jsonb) as id", [P1, J({ tipo: "Costo", descripcion_despues: "x", justificacion: "x", impacto_costo: "1000", contrato_id: CT1 })])))[0].id;
ok(!!cam, "Con su propio contrato sí lo crea");
await esperaError("Tampoco al editarlo", como(G, () => q("select public.cambio_actualizar($1::uuid,$2::jsonb)", [cam, J({ tipo: "Costo", descripcion_despues: "x", justificacion: "x", impacto_costo: "1000", contrato_id: CT2 })])), /no es de este proyecto/);
ok((await q("select valor::text v from public.contratos where id=$1", [CT2]))[0].v === "5000000000.00", "El contrato ajeno no se tocó");

seccion("2. El BAC no se expone");
await esperaError("El interventor no puede pedir el BAC", como(IT, () => q("select public.linea_base_bac($1::uuid)", [P1])), /permission denied/);
await esperaError("Ni el gerente de otro proyecto", como(G2, () => q("select public.linea_base_bac($1::uuid)", [P1])), /permission denied/);

seccion("3. El estado Cerrado no se cambia desde la ficha");
const ficha = (u, estado) => como(u, () => q("select public.proyecto_ficha_guardar($1::uuid,'obra_civil','ejecucion',$2,true,null,null,null)", [P1, estado]));
await esperaError("El gerente no cierra desde la ficha", ficha(G, "cerrado"), /módulo Cierre/);
await ficha(G, "pausa").catch(() => {});
ok((await q("select estado from public.proyectos where id=$1", [P1]))[0].estado !== "cerrado", "El proyecto sigue sin cerrar");
await q("update public.proyectos set estado='cerrado' where id=$1", [P1]);
await esperaError("Ni lo reabre desde la ficha", ficha(G, "activo"), /módulo Cierre/);
await q("update public.proyectos set estado='activo' where id=$1", [P1]);

seccion("4. Cambiar el valor del contrato mantiene el porcentaje de anticipo");
await como(A, () => q("select public.parametro_guardar('global', null, 'anticipo_admin_puede_autorizar', 'si')"));
await como(D, () => q("select public.contrato_anticipo_autorizar($1::uuid, 20, 'Urgencia')", [CT1]));
await como(G, () => q("select public.contrato_actualizar($1::uuid,$2::jsonb)", [CT1, J({ tipo: "obra", contratista: "X", objeto: "Obra", valor: "240000000" })]));
const c1 = (await q("select valor::text v, anticipo_valor::text a, anticipo_pct::text p from public.contratos where id=$1", [CT1]))[0];
ok(c1.a === "48000000.00" && c1.p === "20.00", `Contrato de 240 M con anticipo del 20 % → anticipo 48 M (quedó ${c1.a}, ${c1.p} %)`);

seccion("5. Tope duro del anticipo (20 %)");
await como(A, () => q("select public.parametro_guardar('global', null, 'anticipo_max_pct', '100')"));
const CT3 = await contrato(G, P1, "100000000");
await esperaError("El director no puede autorizar 25 % aunque el parámetro lo permita", como(D, () => q("select public.contrato_anticipo_autorizar($1::uuid, 25, 'Urgencia')", [CT3])), /23514|no es válido|check/i);

seccion("6. Lo firmado y registrado no se altera por borrados en cascada");
const fk = async (tabla, col) => (await q("select c.confdeltype t from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and c.conrelid=('public.'||$1)::regclass and a.attname=$2", [tabla, col]))[0].t;
ok(await fk("informes_interventoria", "alcance_id") === "a" && await fk("informes_interventoria", "acta_pago_id") === "a" && await fk("bitacora_actividades", "tarea_id") === "a", "informes y actividades de bitácora: el borrado se rechaza (no se pone NULL)");

seccion("7. Quien solo consulta no genera mediciones futuras");
await q("insert into public.tareas (proyecto_id, nombre, semana_inicio, duracion_semanas, peso_pct, avance_pct, orden) values ($1,'T1',1,4,100,50,1)", [P1]);
const antes = (await q("select count(*)::int n from public.mediciones_evm where proyecto_id=$1 and fecha_corte='2099-01-01'", [P1]))[0].n;
await como(C, () => q("select public.medicion_calcular($1::uuid, '2099-01-01'::date)", [P1]));
ok((await q("select count(*)::int n from public.mediciones_evm where proyecto_id=$1 and fecha_corte='2099-01-01'", [P1]))[0].n === antes, "consulta no deja filas de 2099");
await como(G, () => q("select public.medicion_calcular($1::uuid, '2026-03-01'::date)", [P1]));
ok((await q("select count(*)::int n from public.mediciones_evm where proyecto_id=$1 and fecha_corte='2026-03-01' and origen='calculado'", [P1]))[0].n === 1, "El gerente sí calcula (la prueba no es vacía)");

seccion("8. Tope del plazo en días hábiles");
await esperaError("Más de 366 días hábiles se rechaza", como(G, () => q("select public.dias_habiles_sumar('2026-01-01'::date, 1000000)")), /entre 0 y 366/);
ok((await como(G, () => q("select public.dias_habiles_sumar('2026-01-01'::date, 5)::text d")))[0].d === "2026-01-08", "5 días hábiles desde el 1 de enero de 2026 (festivo): 2, 5, 6, 7 y 8 de enero (el 6 no es festivo: Reyes pasa al lunes 12) → jueves 8");

seccion("9. Siempre queda un administrador");
await esperaError("El único administrador no puede quitarse el rol", como(A, () => q("update public.perfiles set rol_global = null where id = $1", [A])), /al menos un administrador/);
const A2 = await usuario("a2@x.co", "administrador");
await como(A, () => q("update public.perfiles set rol_global = null where id = $1", [A]));
ok((await q("select rol_global from public.perfiles where id=$1", [A]))[0].rol_global === null, "Con otro administrador sí puede dejar el rol");
void A2;
fin();

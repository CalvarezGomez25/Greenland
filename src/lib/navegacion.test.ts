import { describe, expect, it } from "vitest";
import { armarProyectosNav, enlacesAdministracion, ordenarPorCodigo, proyectoDeRuta, puedeUsarDirectorio } from "./navegacion";

const ID = "8e6e8184-2e51-41ee-a903-2396c5a42212";
const p = (usa_obra: boolean | null = true) => [{ id: ID, nombre: "Obra", codigo: "GL-001", estado: "activo", usa_obra }];
const claves = (rol: Parameters<typeof armarProyectosNav>[2], rolProyecto?: "gerente" | "interventoria" | "supervisor") =>
  armarProyectosNav(p(), new Map(rolProyecto ? [[ID, rolProyecto]] : []), rol)[0].modulos.map((m) => m.clave);

describe("menú lateral", () => {
  it("el administrador ve todos los módulos de obra", () => {
    expect(claves("administrador")).toEqual(expect.arrayContaining(["acta", "presupuesto", "cronograma", "contratos", "bitacora", "interventoria"]));
  });
  it("la interventoría no ve presupuesto, valor ganado ni acta", () => {
    const c = claves(null, "interventoria");
    expect(c).not.toContain("presupuesto");
    expect(c).not.toContain("evm");
    expect(c).not.toContain("acta");
    expect(c).toContain("interventoria");
  });
  it("un proyecto sin área de obra no muestra presupuesto, cronograma, contratos ni bitácora", () => {
    const c = armarProyectosNav(p(false), new Map([[ID, "gerente"]]), null)[0].modulos.map((m) => m.clave);
    for (const k of ["presupuesto", "cronograma", "contratos", "bitacora"]) expect(c).not.toContain(k);
    expect(c).toContain("cambios");
  });
  it("las direcciones apuntan al proyecto", () => {
    expect(armarProyectosNav(p(), new Map(), "administrador")[0].modulos.find((m) => m.clave === "cambios")?.href).toBe(`/proyectos/${ID}/cambios`);
  });
  it("administración según rol", () => {
    expect(enlacesAdministracion("administrador").map((e) => e.href)).toEqual(["/usuarios", "/organizacion", "/parametros", "/auditoria"]);
    expect(enlacesAdministracion("director_general").map((e) => e.href)).toEqual(["/parametros", "/auditoria"]);
    expect(enlacesAdministracion("analista_pmo").map((e) => e.href)).toEqual(["/parametros"]);
    expect(enlacesAdministracion(null)).toEqual([]);
  });
  it("el directorio de contactos solo aparece para quien puede usarlo", () => {
    expect(enlacesAdministracion("administrador", true).map((e) => e.href).at(-1)).toBe("/directorio");
    expect(enlacesAdministracion(null, true)).toEqual([{ href: "/directorio", titulo: "Directorio de contactos" }]);
    expect(enlacesAdministracion(null, false)).toEqual([]);
    expect(puedeUsarDirectorio("administrador", [])).toBe(true);
    expect(puedeUsarDirectorio("director_general", [])).toBe(true);
    expect(puedeUsarDirectorio("analista_pmo", [])).toBe(true);
    expect(puedeUsarDirectorio("finanzas", [])).toBe(false);
    expect(puedeUsarDirectorio(null, ["supervisor", "consulta", "interventoria"])).toBe(false);
    expect(puedeUsarDirectorio(null, ["supervisor", "gerente"])).toBe(true);
  });
  it("detecta el proyecto de la dirección actual", () => {
    expect(proyectoDeRuta(`/proyectos/${ID}/cambios/x`)).toBe(ID);
    expect(proyectoDeRuta(`/proyectos/${ID}`)).toBe(ID);
    expect(proyectoDeRuta("/proyectos/nuevo")).toBeNull();
    expect(proyectoDeRuta("/")).toBeNull();
  });

  it("los proyectos se ordenan por código y no por nombre ni por creación", () => {
    const l = ordenarPorCodigo([
      { codigo: "GL-010", nombre: "Alfa" }, { codigo: "GL-002", nombre: "Zeta" }, { codigo: null, nombre: "Sin código" },
      { codigo: "GL-001", nombre: "Muy tarde" }, { codigo: "GL-002", nombre: "Beta" },
    ]);
    expect(l.map((x) => `${x.codigo ?? "—"} ${x.nombre}`)).toEqual(["GL-001 Muy tarde", "GL-002 Beta", "GL-002 Zeta", "GL-010 Alfa", "— Sin código"]);
  });
});

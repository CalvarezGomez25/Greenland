import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCsvPresupuesto, leerNumeroColombiano, MAX_FILAS_IMPORTACION } from "./csv";

const archivo = (nombre: string) => readFileSync(resolve(process.cwd(), "ejemplos", nombre), "utf8");
const ENCABEZADO = "capitulo;codigo;descripcion;unidad;cantidad;precio_unitario";

describe("archivo de ejemplo correcto", () => {
  const r = leerCsvPresupuesto(archivo("presupuesto-ejemplo.csv"));

  it("lee las 10 partidas sin errores", () => {
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(10);
    expect(r.filasLeidas).toBe(10);
    expect(r.separador).toBe(";");
    expect(r.encabezado).toBe(true);
  });

  it("convierte los números del formato colombiano a punto decimal", () => {
    expect(r.filas[0]).toEqual({
      fila: 2,
      capitulo: "Preliminares",
      codigo: "1.01",
      descripcion: "Localización y replanteo",
      unidad: "m2",
      cantidad: "1200",
      precio_unitario: "4500",
    });
    expect(r.filas[8].precio_unitario).toBe("96000000");
  });
});

describe("archivo con errores a propósito", () => {
  const r = leerCsvPresupuesto(archivo("presupuesto-con-errores.csv"));

  it("acepta 2 filas y rechaza 6, cada una con su fila y motivo", () => {
    expect(r.filas.map((f) => f.codigo)).toEqual(["1.01", "1.02"]);
    expect(r.errores.map((e) => e.fila)).toEqual([4, 5, 6, 7, 8, 9]);
    const mensajes = r.errores.map((e) => e.mensaje);
    expect(mensajes[0]).toMatch(/Falta el capítulo/);
    expect(mensajes[1]).toMatch(/cantidad no es un número/);
    expect(mensajes[2]).toMatch(/precio unitario no puede ser negativo/);
    expect(mensajes[3]).toMatch(/Faltan columnas.*6.*5/);
    expect(mensajes[4]).toMatch(/código "1.01" está repetido.*fila 2/);
    expect(mensajes[5]).toMatch(/Falta la unidad/);
  });

  it("conserva los decimales en formato colombiano", () => {
    expect(r.filas[0].cantidad).toBe("1234.56");
    expect(r.filas[0].precio_unitario).toBe("4500.50");
  });
});

describe("otros formatos de archivo", () => {
  it("separado por comas, con comillas, comas dentro del texto y decimales", () => {
    const csv = [
      "capitulo,codigo,descripcion,unidad,cantidad,precio_unitario",
      'A,1,"Muro, bloque ""10""",m2,"1.234,56","4.500,50"',
    ].join("\n");
    const r = leerCsvPresupuesto(csv);
    expect(r.errores).toEqual([]);
    expect(r.separador).toBe(",");
    expect(r.filas[0].descripcion).toBe('Muro, bloque "10"');
    expect(r.filas[0].cantidad).toBe("1234.56");
    expect(r.filas[0].precio_unitario).toBe("4500.50");
  });

  it("separado por tabulador", () => {
    const r = leerCsvPresupuesto("A\t1\tMuro\tm2\t10\t1.000\nA\t2\tPiso\tm2\t5,5\t2.000");
    expect(r.errores).toEqual([]);
    expect(r.separador).toBe("\t");
    expect(r.filas.map((f) => f.cantidad)).toEqual(["10", "5.5"]);
  });

  it("con BOM, saltos de línea de Windows y líneas vacías", () => {
    const r = leerCsvPresupuesto(`﻿${ENCABEZADO}\r\nA;1;Muro;m2;10;1.000\r\n\r\n;;;;;\r\nA;2;Piso;m2;5;2.000\r\n`);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(2);
    expect(r.filasLeidas).toBe(2);
  });

  it("sin fila de encabezado", () => {
    const r = leerCsvPresupuesto("A;1;Muro;m2;10;1.000");
    expect(r.encabezado).toBe(false);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].fila).toBe(1);
  });

  it("encabezado con acentos y mayúsculas", () => {
    const r = leerCsvPresupuesto("Capítulo;Código;Descripción;Unidad;Cantidad;Precio\nA;1;Muro;m2;10;1.000");
    expect(r.encabezado).toBe(true);
    expect(r.filas).toHaveLength(1);
  });

  it("campo entre comillas con salto de línea adentro", () => {
    const r = leerCsvPresupuesto(`${ENCABEZADO}\nA;1;"Muro\nen bloque";m2;10;1.000`);
    expect(r.errores).toEqual([]);
    expect(r.filas[0].descripcion).toBe("Muro\nen bloque");
  });

  it("ignora columnas vacías al final y rechaza columnas con contenido de más", () => {
    expect(leerCsvPresupuesto(`${ENCABEZADO}\nA;1;Muro;m2;10;1.000;;`).errores).toEqual([]);
    const r = leerCsvPresupuesto(`${ENCABEZADO}\nA;1;Muro;m2;10;1.000;sobra`);
    expect(r.errores[0].mensaje).toMatch(/Sobran columnas/);
  });

  it("detecta una comilla sin cerrar", () => {
    const r = leerCsvPresupuesto(`${ENCABEZADO}\nA;1;"Muro;m2;10;1.000`);
    expect(r.errores.some((e) => e.fila === null && /comilla sin cerrar/.test(e.mensaje))).toBe(true);
  });
});

describe("límites y archivos inválidos", () => {
  it("archivo vacío", () => {
    expect(leerCsvPresupuesto("").errores[0].mensaje).toMatch(/vacío/);
    expect(leerCsvPresupuesto("  \n \n").errores[0].mensaje).toMatch(/vacío/);
  });

  it("solo encabezado", () => {
    expect(leerCsvPresupuesto(ENCABEZADO).errores[0].mensaje).toMatch(/no tiene filas de datos/);
  });

  it("más de 5.000 filas", () => {
    const filas = Array.from({ length: MAX_FILAS_IMPORTACION + 1 }, (_, i) => `A;c${i};d;u;1;1`);
    const r = leerCsvPresupuesto([ENCABEZADO, ...filas].join("\n"));
    expect(r.filas).toEqual([]);
    expect(r.errores[0].mensaje).toMatch(/5000/);
  });

  it("exactamente 5.000 filas es válido", () => {
    const filas = Array.from({ length: MAX_FILAS_IMPORTACION }, (_, i) => `A;c${i};d;u;1;1`);
    const r = leerCsvPresupuesto([ENCABEZADO, ...filas].join("\n"));
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(MAX_FILAS_IMPORTACION);
  });

  it("archivo de más de 2 MB", () => {
    const r = leerCsvPresupuesto("x".repeat(2_000_001));
    expect(r.errores[0].mensaje).toMatch(/2 MB/);
  });

  it("textos demasiado largos", () => {
    const r = leerCsvPresupuesto(`${ENCABEZADO}\n${"x".repeat(121)};1;d;u;1;1\nA;2;${"x".repeat(301)};u;1;1\nA;3;d;${"x".repeat(21)};1;1`);
    expect(r.errores.map((e) => e.mensaje)).toEqual([
      expect.stringMatching(/capítulo supera 120/),
      expect.stringMatching(/descripción supera 300/),
      expect.stringMatching(/unidad supera 20/),
    ]);
  });
});

describe("leerNumeroColombiano", () => {
  const num = (t: string, dec = 4, ent = 14) => leerNumeroColombiano(t, dec, ent);

  it("acepta los formatos colombianos", () => {
    expect(num("1234")).toEqual({ ok: true, valor: "1234" });
    expect(num("1.234")).toEqual({ ok: true, valor: "1234" }); // el punto es separador de miles
    expect(num("1.234.567,89")).toEqual({ ok: true, valor: "1234567.89" });
    expect(num("0,5")).toEqual({ ok: true, valor: "0.5" });
    expect(num("10,50")).toEqual({ ok: true, valor: "10.50" });
    expect(num("0")).toEqual({ ok: true, valor: "0" });
    expect(num("007")).toEqual({ ok: true, valor: "7" });
    expect(num(" $ 4.500 ")).toEqual({ ok: true, valor: "4500" });
  });

  it("rechaza el punto decimal al estilo inglés en vez de adivinar", () => {
    for (const t of ["1234.56", "1.5", "12.34", "1.2345,1", "1,234.56"]) {
      const r = num(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/formato no reconocido/);
    }
  });

  it("rechaza vacíos, negativos y texto", () => {
    expect(num("")).toMatchObject({ ok: false, motivo: "no tiene valor" });
    expect(num("-5")).toMatchObject({ ok: false, motivo: "no puede ser negativo" });
    expect(num("(5)")).toMatchObject({ ok: false, motivo: "no puede ser negativo" });
    expect(num("abc")).toMatchObject({ ok: false, motivo: "no es un número" });
    expect(num("12abc")).toMatchObject({ ok: false, motivo: "no es un número" });
    expect(num(",5")).toMatchObject({ ok: false });
  });

  it("respeta el máximo de decimales y de dígitos", () => {
    expect(num("1,23456")).toMatchObject({ ok: false, motivo: "tiene más de 4 decimales" });
    expect(num("10,555", 2)).toMatchObject({ ok: false, motivo: "tiene más de 2 decimales" });
    expect(num("100.000.000.000.000.000")).toMatchObject({ ok: false, motivo: "es demasiado grande" });
  });
});

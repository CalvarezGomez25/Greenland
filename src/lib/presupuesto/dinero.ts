// Aritmética EXACTA para dinero, cantidades y porcentajes.
//
// Los números decimales de JavaScript (0.1 + 0.2 = 0.30000000000000004) no sirven para
// dinero. Aquí cada valor se guarda como un entero grande (bigint) multiplicado por una
// potencia de 10 ("escala"): 1.234,56 pesos con escala 2 es 123456n. Así las sumas y
// los productos son exactos, sin errores de redondeo.
//
// Escalas usadas:
//   cantidad    4 decimales (igual que la base de datos)
//   precio      2 decimales
//   porcentaje  4 decimales (19 % = 190000n)
//   monto       6 decimales: cantidad (4) × precio (2). Todos los totales usan esta escala.
//
// Los montos se muestran redondeados a pesos (mitad hacia arriba). Los cálculos internos
// no se redondean, así que la suma de cifras mostradas puede diferir en un peso del total
// mostrado: el total es siempre el exacto.

export const ESCALA = { cantidad: 4, precio: 2, porcentaje: 4, monto: 6 } as const;

const potencia10 = (n: number): bigint => 10n ** BigInt(n);
export const UN_PESO = potencia10(ESCALA.monto);

// "1234.56" (punto decimal, como lo entrega la base de datos) → entero escalado.
export function aEscalado(texto: string, escala: number): bigint {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(texto.trim());
  if (!m) throw new RangeError(`Número no válido: "${texto}"`);
  const [, signo, entero, decimales = ""] = m;
  const sinCeros = decimales.replace(/0+$/, ""); // ceros finales no cuentan: "100.0000"
  if (sinCeros.length > escala) {
    throw new RangeError(`"${texto}" tiene más de ${escala} decimales`);
  }
  const valor = BigInt(entero + sinCeros.padEnd(escala, "0"));
  return signo === "-" ? -valor : valor;
}

// Valor leído de la base de datos (puede llegar como número o como texto).
export function desdeJson(valor: number | string, escala: number): bigint {
  if (typeof valor === "string") return aEscalado(valor, escala);
  if (!Number.isFinite(valor)) throw new RangeError("Número fuera de rango");
  const texto = String(valor);
  if (/e/i.test(texto)) throw new RangeError(`Número fuera de rango: ${texto}`);
  // Un número de JavaScript solo conserva ~15 cifras significativas. Si hay más, pudo
  // perder precisión al llegar: se falla en voz alta en vez de mostrar dinero incorrecto.
  if (texto.replace(/^-|\./g, "").replace(/^0+/, "").length > 15) {
    throw new RangeError(`Número con demasiada precisión para leerlo con seguridad: ${texto}`);
  }
  return aEscalado(texto, escala);
}

// División entera redondeada (mitad lejos de cero). El divisor no puede ser cero.
export function dividirRedondeado(numerador: bigint, divisor: bigint): bigint {
  if (divisor === 0n) throw new RangeError("División por cero");
  const negativo = numerador < 0n !== divisor < 0n;
  const n = numerador < 0n ? -numerador : numerador;
  const d = divisor < 0n ? -divisor : divisor;
  const cociente = (2n * n + d) / (2n * d);
  return negativo ? -cociente : cociente;
}

export const redondearAPesos = (monto: bigint): bigint => dividirRedondeado(monto, UN_PESO);

const conMiles = (digitos: string): string => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Monto (escala 6) → "1.231.970.000" (pesos, redondeado).
export function formatearPesos(monto: bigint): string {
  const pesos = redondearAPesos(monto < 0n ? -monto : monto);
  return `${monto < 0n && pesos !== 0n ? "-" : ""}${conMiles(pesos.toString())}`;
}

function partirEscalado(valor: bigint, escala: number) {
  const negativo = valor < 0n;
  const texto = (negativo ? -valor : valor).toString().padStart(escala + 1, "0");
  return {
    negativo,
    entero: texto.slice(0, texto.length - escala),
    decimales: texto.slice(texto.length - escala).replace(/0+$/, ""),
  };
}

// Valor escalado → formato colombiano: "1.234,56". Sin ceros decimales sobrantes,
// salvo que se pidan con minDecimales.
export function formatearDecimal(valor: bigint, escala: number, minDecimales = 0): string {
  const { negativo, entero, decimales } = partirEscalado(valor, escala);
  const dec = decimales.padEnd(minDecimales, "0");
  return `${negativo ? "-" : ""}${conMiles(entero)}${dec ? `,${dec}` : ""}`;
}

// Valor escalado → texto con punto decimal para enviar a la base de datos: "1234.56".
export function aTextoPunto(valor: bigint, escala: number): string {
  const { negativo, entero, decimales } = partirEscalado(valor, escala);
  return `${negativo ? "-" : ""}${entero}${decimales ? `.${decimales}` : ""}`;
}

// parte / total × 100, con 2 decimales (p. ej. 33,33). Null si el total no es positivo.
export function porcentajeDe(parte: bigint, total: bigint): number | null {
  if (total <= 0n) return null;
  return Number(dividirRedondeado(parte * 10_000n, total)) / 100;
}

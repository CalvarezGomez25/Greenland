import Link from "next/link";
import { Titulo } from "@/components/ui";

export const metadata = { title: "Acerca de FARO · PMO360" };

// FARO: marco de cuatro pasos para explicar y adoptar la plataforma (ADR-0019, sección 17 de la especificación).
// Todo lo que se afirma aquí corresponde a algo que la plataforma hace hoy; no se citan cifras de ahorro porque no existen.

const PASOS = [
  {
    letra: "F", nombre: "Fuente única", pregunta: "¿Cómo va realmente cada proyecto?",
    idea: "Un solo lugar para el estado, el costo, los contratos y los riesgos, en lugar de varios archivos que dicen cosas distintas.",
    hace: [
      "El semáforo del proyecto toma la peor de cuatro señales (cronograma, costo, riesgo y cambios pendientes).",
      "Donde falta información dice «Sin datos» en vez de mostrar un verde sin verificar.",
      "RAIZ guarda cada contratista, proveedor o interventor una sola vez, con sus documentos, y el presupuesto se liga a la EDT.",
    ],
    enlaces: [{ href: "/", t: "Tablero de control" }, { href: "/aliados", t: "RAIZ" }],
  },
  {
    letra: "A", nombre: "Alerta a tiempo", pregunta: "¿Quién decide y cuándo se entera?",
    idea: "La información llega a quien debe decidir antes de que el problema sea grande.",
    hace: [
      "El tablero «Requiere decisión» reúne lo que espera una respuesta.",
      "Se envía correo a quien decide, hay un resumen diario y un informe de una página cada lunes.",
      "El semáforo de cada contrato avisa etapas vencidas, pólizas y documentos por vencer y compromisos sin cumplir.",
    ],
    enlaces: [{ href: "/mi-trabajo", t: "Mi trabajo" }],
  },
  {
    letra: "R", nombre: "Respaldo", pregunta: "¿Por qué creerle a este dato?",
    idea: "Un número vale lo que vale su origen: quién lo registró, bajo qué regla y con qué permiso.",
    hace: [
      "Los permisos por rol se aplican en la base de datos, no solo en la pantalla; la interventoría no ve costos.",
      "Los cambios importantes quedan registrados con quién y cuándo.",
      "Las reglas y los supuestos están escritos, y la plataforma se prueba con más de mil comprobaciones automáticas.",
    ],
    enlaces: [{ href: "/glosario", t: "Ayuda: glosario y guías" }],
  },
  {
    letra: "O", nombre: "Operación que escala", pregunta: "¿Aguanta más proyectos, más gente y más tiempo?",
    idea: "Que funcione igual con 12 proyectos que con 3, y que no dependa de una sola persona.",
    hace: [
      "Usa una base de datos estándar (Postgres) y se instala con un solo archivo.",
      "Está documentada, con las decisiones y sus razones.",
      "Sus límites técnicos están declarados y alcanzan para 12 proyectos.",
    ],
    enlaces: [],
  },
] as const;

// Cuatro cuartos de vuelta alrededor de «PMO360» (4 × 90° = 360°). Arcos con separación de 4° entre sí.
function arco(i: number): string {
  const R = 78, c = 100, ini = (-90 + i * 90 + 3) * (Math.PI / 180), fin = (-90 + (i + 1) * 90 - 3) * (Math.PI / 180);
  const p = (a: number) => `${(c + R * Math.cos(a)).toFixed(2)} ${(c + R * Math.sin(a)).toFixed(2)}`;
  return `M ${p(ini)} A ${R} ${R} 0 0 1 ${p(fin)}`;
}
const COLORES = ["#027001", "#1C6C36", "#71986B", "#84B71E"];
const POS_LETRA = [[155, 45], [155, 155], [45, 155], [45, 45]];

function Anillo() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Anillo de 360 grados dividido en cuatro cuartos: F, A, R y O, alrededor de PMO360" className="mx-auto h-56 w-56 shrink-0">
      {PASOS.map((_, i) => <path key={i} d={arco(i)} fill="none" stroke={COLORES[i]} strokeWidth="14" strokeLinecap="round" />)}
      {PASOS.map((p, i) => <text key={p.letra} x={POS_LETRA[i][0]} y={POS_LETRA[i][1]} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill="#FFFFFF">{p.letra}</text>)}
      <text x="100" y="97" textAnchor="middle" fontSize="19" fontWeight="700" fill="#027001">PMO360</text>
      <text x="100" y="116" textAnchor="middle" fontSize="10" fill="#5E5E5E">4 × 90° = 360°</text>
    </svg>
  );
}

export default function PaginaFaro() {
  return (
    <>
      <Titulo>Acerca de FARO</Titulo>
      <p className="mt-3 max-w-3xl text-lg font-light text-leaf-800">Que ningún proyecto navegue a ciegas.</p>

      <section className="mt-6 grid items-center gap-6 rounded-card bg-leaf-50 p-6 md:grid-cols-[auto_1fr]" aria-labelledby="t-nombre">
        <Anillo />
        <div className="max-w-2xl text-sm text-leaf-900">
          <h2 id="t-nombre" className="font-display text-2xl font-bold text-leaf-700">PMO360 es la luz; FARO es cómo la mantenemos encendida</h2>
          <p className="mt-3"><b>PMO360</b> es esta plataforma, «Control integral de Proyectos». El <b>360</b> es la vuelta completa: ver el portafolio entero, sin puntos ciegos.</p>
          <p className="mt-2"><b>FARO</b> es el marco para explicarla y adoptarla, en cuatro pasos. Cada paso ilumina un cuarto de vuelta, y juntos completan los 360°.</p>
          <p className="mt-2 text-muted">Un faro no evita la tormenta: evita que se navegue a ciegas. La plataforma no reemplaza el criterio del gerente ni promete ahorros.</p>
        </div>
      </section>

      <h2 className="mt-8 font-display text-2xl font-bold text-leaf-700">Los cuatro pasos</h2>
      <ol className="mt-3 grid gap-4 md:grid-cols-2">
        {PASOS.map((p, i) => (
          <li key={p.letra} className="rounded-card border border-soil-border p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: COLORES[i] }}>{p.letra}</span>
              <div><h3 className="font-display text-xl font-bold text-leaf-700">{p.nombre}</h3><p className="text-xs text-muted">{p.pregunta}</p></div>
            </div>
            <p className="mt-3 text-sm text-leaf-900">{p.idea}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Lo que la plataforma hace hoy</p>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm text-leaf-900">{p.hace.map((h) => <li key={h} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-600" />{h}</li>)}</ul>
            {p.enlaces.length > 0 && <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">{p.enlaces.map((e) => <Link key={e.href} href={e.href} className="font-medium text-leaf-600 hover:underline">{e.t} →</Link>)}</p>}
          </li>
        ))}
      </ol>

      <section className="mt-8 max-w-3xl" aria-labelledby="t-origen">
        <h2 id="t-origen" className="font-display text-2xl font-bold text-leaf-700">De dónde salió</h2>
        <p className="mt-2 text-sm text-leaf-900">
          El 11 de octubre de 2026 se pidió un marco de máximo cuatro pasos para explicar la utilidad, la sostenibilidad y la escalabilidad de la plataforma ante colegas, jefes y junta.
          Se propusieron dos nombres (BASE y FARO) y se eligió FARO, con la imagen del faro como punto de partida. Más tarde se notó que faltaba explicar su relación con PMO360, y de ahí salió la vuelta completa de cuatro cuartos.
        </p>
        <p className="mt-2 text-sm text-leaf-900">
          Se evaluaron casos reales de infraestructura colombiana como ejemplo y se descartaron: eran sensibles, algunos siguen en proceso, y sus cifras no se pudieron contrastar con fuentes primarias. Por eso las escenas de los pasos A, R y O son ejemplos típicos, no casos reales de GreenLand.
        </p>
        <p className="mt-2 text-sm text-muted">Registro completo: decisión ADR-0019 y sección 17 de la especificación.</p>
      </section>

      <section className="mt-8 max-w-3xl" aria-labelledby="t-piloto">
        <h2 id="t-piloto" className="font-display text-2xl font-bold text-leaf-700">Lo que se propone y lo que se declara de frente</h2>
        <p className="mt-2 text-sm text-leaf-900">Un <b>piloto de 90 días</b> con 3 o 4 de los 12 proyectos, con criterios de éxito acordados con la dirección antes de empezar. Se mide el tiempo de preparar el informe semanal, la antigüedad de las decisiones pendientes, los datos incorrectos encontrados, la puntualidad de los reportes y la percepción de gerentes y directores.</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-leaf-900">
          {["Hoy todos los datos son ficticios.", "No hay cifras de ahorro: no existe una línea base, y no se citan.", "Falta calcular el costo de operación y no hay una revisión de seguridad independiente.", "Tampoco se ha comparado con software comercial."].map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-earth-600" />{t}</li>)}
        </ul>
      </section>
    </>
  );
}

"use client";

import "./mapa.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CARRILES, CARRIL_POR_ID, DECISIONES, ESENCIALES, ETAPAS, MODULO_POR_ID, RK, ROLES,
  type ModuloMapa, type Nivel, type RolClave,
} from "@/lib/mapa/datos";
import { configuracion, curva, disponer, flujosVisibles, modulosVisibles, panelLateral, type Detalle, type Disposicion, type Rect } from "@/lib/mapa/geometria";

type Estado = { sel: string | null; rol: RolClave | null; todas: boolean; det: Detalle };
const vars = (o: Record<string, string | number>) => o as CSSProperties;
const NIVEL_TEXTO: Record<Nivel, string> = { D: "◆ DECIDE", H: "● TRABAJA", V: "○ CONSULTA" };

function clasesDe(m: ModuloMapa, e: Estado, relacionado: (id: string) => boolean): string {
  const c: string[] = [];
  if (e.rol) c.push("mp-lv" + (m.ro[e.rol] ?? "0"));
  if (e.sel === m.id) c.push("mp-sel");
  else if (e.sel && relacionado(m.id)) c.push("mp-rel");
  else if (e.sel) c.push("mp-dim");
  return c.join(" ");
}

function Etapas({ d, brief }: { d: Disposicion; brief: boolean }) {
  return (
    <>
      {ETAPAS.map((e, i) => (
        <div key={e.n} className={`mp-etapa${i === 0 ? " mp-first" : ""}`} style={{ left: d.cfg.lab + i * d.colW + 2, top: d.cfg.top, width: d.colW - 2, height: d.cfg.spineH }}>
          <span className="mp-n">Etapa {e.n}</span><span className="mp-t">{e.t}</span>{!brief && <span className="mp-s">{e.s}</span>}
        </div>
      ))}
    </>
  );
}

function Flujos({ d, e, rectDe }: { d: Disposicion; e: Estado; rectDe: (id: string) => Rect }) {
  const fl = flujosVisibles(e.det);
  const ocupados = Object.values(d.rect);
  const alto = d.end + 10;
  const items = fl.map((f, i) => ({ f, i, c: curva(rectDe(f[0]), rectDe(f[1]), ocupados) }));
  const num = items.filter(({ f }) => e.sel && (f[0] === e.sel || f[1] === e.sel));
  return (
    <>
      <svg width={d.cfg.W} height={alto} viewBox={`0 0 ${d.cfg.W} ${alto}`} aria-hidden>
        <defs><marker id="mp-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#4c700b" /></marker></defs>
        {items.map(({ f, i, c }) => {
          const activa = e.sel && (f[0] === e.sel || f[1] === e.sel);
          return <path key={i} className={`mp-fl${activa ? " mp-on mp-selfl" : e.todas ? " mp-all" : ""}`} d={c.d} markerEnd="url(#mp-ah)" />;
        })}
      </svg>
      <svg className="mp-nums" width={d.cfg.W} height={alto} viewBox={`0 0 ${d.cfg.W} ${alto}`} aria-hidden>
        {num.map(({ i, c }) => (
          <g key={i}><circle className="mp-flnum" cx={c.mx} cy={c.my} r={9} /><text className="mp-flt" x={c.mx} y={c.my}>{i + 1}</text></g>
        ))}
      </svg>
    </>
  );
}

type Acciones = { elegir: (id: string) => void };

function Carriles({ det, e, a }: { det: Detalle; e: Estado; a: Acciones }) {
  const cfg = configuracion(det);
  const d = useMemo(() => disponer(cfg, det), [cfg.W, det]); // eslint-disable-line react-hooks/exhaustive-deps
  const brief = det === "brief";
  const fl = flujosVisibles(det);
  const rel = (id: string) => !!e.sel && fl.some((f) => (f[0] === e.sel && f[1] === id) || (f[1] === e.sel && f[0] === id));
  const y0 = cfg.top + cfg.spineH + 3;
  return (
    <>
      <Etapas d={d} brief={brief} />
      {CARRILES.map((l) => {
        const L = d.lanes[l.id];
        return (
          <div key={l.id}>
            <div className="mp-lane" style={vars({ "--lc": `var(--l${l.c})`, "--lt": `var(--l${l.c}t)`, left: 0, top: L.y, width: cfg.W, height: L.h })} />
            <div className="mp-lanelabel" style={vars({ "--lc": `var(--l${l.c})`, left: 6, top: L.y + 8, width: cfg.lab - 14, height: L.h - 16 })}>
              <b>{l.n}</b>{!brief && <i>{l.s}</i>}
            </div>
          </div>
        );
      })}
      {!brief && ETAPAS.map((et, i) => (
        <div key={et.n}>
          <div className={`mp-vband${i % 2 === 0 ? " mp-odd" : ""}`} style={{ left: cfg.lab + i * d.colW, top: y0, width: d.colW, height: d.end - y0 + 5 }} />
          {i > 0 && <div className="mp-vline" style={{ left: cfg.lab + i * d.colW, top: y0, height: d.end - y0 + 5 }} />}
        </div>
      ))}
      {!brief && CARRILES.map((l, li) => ETAPAS.map((et, i) => (
        <span key={`${l.id}${et.n}`} className={`mp-stag${li ? " mp-num" : ""}`} style={vars({ "--lc": `var(--l${l.c})`, left: cfg.lab + i * d.colW + d.colW / 2, top: d.lanes[l.id].y })}>
          <b>{et.n}</b>{li ? "" : et.t}
        </span>
      )))}
      <Flujos d={d} e={e} rectDe={(id) => d.rect[id]} />
      {modulosVisibles(det).map((m) => {
        const r = d.rect[m.id], L = CARRIL_POR_ID[m.l];
        const nivel = e.rol ? m.ro[e.rol] : undefined;
        return (
          <button key={m.id} type="button" className={`mp-node ${clasesDe(m, e, rel)}`} data-id={m.id} onClick={() => a.elegir(m.id)}
            style={vars({ "--lc": `var(--l${L.c})`, "--lt": `var(--l${L.c}t)`, left: r.x, top: r.y, width: r.w, height: r.h })} aria-label={`${m.nm}: ${m.co}`}>
            {DECISIONES.some((x) => x.m === m.id) && <span className="mp-gate" title="Punto de decisión">◆</span>}
            <span className="mp-hd"><span className="mp-nm">{m.nm}</span></span><span className="mp-us">{m.co}</span>
            {e.rol && nivel && <span className="mp-lvl">{NIVEL_TEXTO[nivel]}</span>}
          </button>
        );
      })}
    </>
  );
}

function Mapa({ e, a }: { e: Estado; a: Acciones }) {
  const cfg = configuracion(e.det);
  const caja = useRef<HTMLDivElement>(null);
  const [esc, setEsc] = useState(1);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setEsc(Math.max(0.5, Math.min(1.3, (el.clientWidth - 2) / cfg.W)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg.W]);
  const alto = disponer(cfg, e.det).end + 10;
  return (
    <div className="mp-wrap" ref={caja}>
      <div className="mp-sizer" style={{ width: cfg.W * esc, height: alto * esc }}>
        <div className="mp-canvas" style={{ width: cfg.W, height: alto, transform: `scale(${esc})` }}>
          <Carriles det={e.det} e={e} a={a} />
        </div>
      </div>
    </div>
  );
}

function Panel({ e, ir, limpiar }: { e: Estado; ir: (id: string) => void; limpiar: () => void }) {
  const fl = flujosVisibles(e.det);
  const ms = modulosVisibles(e.det);
  const m = e.sel ? MODULO_POR_ID[e.sel] : null;
  if (m && ms.includes(m)) {
    const L = CARRIL_POR_ID[m.l];
    const etapa = m.l === "bas" ? "Todo el ciclo" : m.a === m.b ? `Etapa ${m.a} · ${ETAPAS[m.a - 1].t}` : `Etapas ${m.a} a ${m.b} · ${ETAPAS[m.a - 1].t} a ${ETAPAS[m.b - 1].t}`;
    const entra = fl.filter((f) => f[1] === m.id), sale = fl.filter((f) => f[0] === m.id), dec = DECISIONES.filter((x) => x.m === m.id);
    const grupos = (["D", "H", "V"] as Nivel[]).map((v) => ({ v, rs: RK.filter((k) => m.ro[k] === v).map((k) => ROLES.find((r) => r.k === k)!.n) })).filter((g) => g.rs.length);
    return (
      <aside className="mp-panel" style={vars({ "--lc": `var(--l${L.c})` })} aria-live="polite">
        <span className="mp-tag">{L.n}</span><span className="mp-tag" style={vars({ "--lc": "var(--mp-muted)" })}>{etapa}</span>
        <h2>{m.nm}</h2>
        <p>{m.us}</p><p className="mp-muted">{m.de}</p>
        {dec.length > 0 && (<><h3>Puntos de decisión</h3><ul>{dec.map((x, i) => <li key={i}><span style={{ color: "var(--mp-earth)" }}>◆</span> <b>{x.r}</b>: {x.t}</li>)}</ul></>)}
        <h3>Quién lo usa</h3>
        <div className="mp-rolelist">{grupos.map((g) => (<span key={g.v} style={{ display: "contents" }}><span><b>{g.v === "D" ? "◆ Decide" : g.v === "H" ? "● Trabaja" : "○ Consulta"}</b></span><span>{g.rs.join(", ")}</span></span>))}</div>
        {entra.length > 0 && (<><h3>Recibe de</h3><ul>{entra.map((f, i) => <li key={i}><button type="button" className="mp-link" onClick={() => ir(f[0])}>{MODULO_POR_ID[f[0]].nm}</button> <span className="mp-muted">· {f[2]}</span></li>)}</ul></>)}
        {sale.length > 0 && (<><h3>Alimenta a</h3><ul>{sale.map((f, i) => <li key={i}><button type="button" className="mp-link" onClick={() => ir(f[1])}>{MODULO_POR_ID[f[1]].nm}</button> <span className="mp-muted">· {f[2]}</span></li>)}</ul></>)}
        <h3>Dónde está en la plataforma</h3><div className="mp-path">{m.ru}</div>
        <p style={{ marginTop: 14 }}><button type="button" className="mp-pill" onClick={limpiar}>Ver el mapa completo</button></p>
      </aside>
    );
  }
  if (e.rol) {
    const r = ROLES.find((x) => x.k === e.rol)!;
    const cuenta = (["D", "H", "V"] as Nivel[]).map((v) => ms.filter((x) => x.ro[e.rol!] === v).length);
    const decs = DECISIONES.filter((x) => x.r.includes(e.rol!.toUpperCase()));
    return (
      <aside className="mp-panel" aria-live="polite">
        <span className="mp-tag">Rol</span><h2>{r.n}</h2><p>{r.p}</p>
        <h3>En el mapa</h3><p>Decide en {cuenta[0]} módulos, trabaja en {cuenta[1]} y consulta {cuenta[2]}. Los demás no los ve.</p>
        <h3>Sus puntos de decisión</h3>
        {decs.length ? <ul>{decs.map((x, i) => <li key={i}><span style={{ color: "var(--mp-earth)" }}>◆</span> <button type="button" className="mp-link" onClick={() => ir(x.m)}>{MODULO_POR_ID[x.m].nm}</button>: {x.t}</li>)}</ul> : <p className="mp-muted">Este rol no aprueba nada en la plataforma.</p>}
        <p className="mp-hint">El borde grueso marca donde decide; el discontinuo, donde solo consulta; lo apagado no lo ve.</p>
      </aside>
    );
  }
  return (
    <aside className="mp-panel" aria-live="polite">
      <h2>Cómo leer el mapa</h2>
      <p>De izquierda a derecha están las seis etapas del proyecto. Cada paquete de trabajo es una fila de color y cada módulo se ubica en la etapa donde se usa.</p>
      <h3>Para descubrirlo</h3>
      <ul>
        <li>Haz clic en un módulo: verás qué hace, quién lo usa y de dónde recibe y a dónde entrega sus datos.</li>
        <li>Elige un rol arriba: el mapa se ilumina según lo que ese rol ve, hace y decide.</li>
        <li>«Ver todas las conexiones» muestra las {fl.length} flechas de datos a la vez.</li>
                <li>La versión <b>resumida</b> deja los {ESENCIALES.size} módulos esenciales, sin franjas ni marcas de etapa.</li>
      </ul>
      <h3>Los puntos de decisión</h3>
      <p>Hay {DECISIONES.length} (marcados con ◆) donde una persona concreta aprueba algo: firmar el acta, aprobar contratos y anticipos, cambios según su nivel, adjudicar, aplicar novedades y cerrar.</p>
      <p className="mp-hint">La etapa en que se ubica cada módulo es una guía de uso, no una restricción: la plataforma deja registrar en cualquier momento lo que el rol permite.</p>
    </aside>
  );
}

const LAMINAS = [
  { f: "PMO360-mapa-carriles-completo-A2.pdf", t: "Matriz de carriles, completa (A2)" },
  { f: "PMO360-mapa-carriles-resumido-A3.pdf", t: "Matriz de carriles, resumida (A3)" },
  { f: "PMO360-mapa-metro-resumido-A3.pdf", t: "Mapa de metro, resumido (A3), solo para imprimir" },
];

export function MapaProceso() {
  const [e, setE] = useState<Estado>({ sel: null, rol: null, todas: false, det: "full" });
  const [eleccion, setEleccion] = useState<boolean | null>(null); // null: lo decide el ancho de la pantalla
  const raiz = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lateral = panelLateral(ancho, eleccion);
  const hoja = !lateral && !!(e.sel || e.rol); // sin panel lateral, el detalle se fija al pie mientras haya algo elegido
  const anchoPanel = ancho < 1150 ? 270 : 300;
  const set = (p: Partial<Estado>) => setE((x) => ({ ...x, ...p }));
  const elegir = (id: string) => setE((x) => ({ ...x, sel: x.sel === id ? null : id }));
  const a: Acciones = { elegir };
  return (
    <div className="mp-root" ref={raiz}>
      <div className="mp-ctl">
        <div className="mp-grp"><b>Detalle</b>
          <button type="button" className="mp-pill" aria-pressed={e.det === "full"} onClick={() => set({ det: "full" })}>Completo</button>
          <button type="button" className="mp-pill" aria-pressed={e.det === "brief"} onClick={() => set({ det: "brief" })}>Resumido</button>
        </div>
        <div className="mp-grp"><button type="button" className="mp-pill" aria-pressed={e.todas} onClick={() => set({ todas: !e.todas })}>Ver todas las conexiones</button><button type="button" className="mp-pill" aria-pressed={lateral} onClick={() => setEleccion(!lateral)}>Panel de detalle</button></div>
      </div>
      <div className="mp-rolesbar" role="group" aria-label="Ver el mapa según el rol">
        <b>Ver como</b>
        <button type="button" className="mp-pill" aria-pressed={!e.rol} onClick={() => set({ rol: null })}>Sin filtro</button>
        {ROLES.map((r) => <button key={r.k} type="button" className="mp-pill" aria-pressed={e.rol === r.k} onClick={() => set({ rol: r.k })}>{r.n}</button>)}
      </div>
      <div className={`mp-layout${lateral ? "" : " mp-solo"}${hoja ? " mp-narrow" : ""}`} style={vars({ "--mp-pw": `${anchoPanel}px` })}>
        <div>
          <Mapa e={e} a={a} />
          <div className="mp-legend">
            <span><i className="mp-k mp-kD" /> Decide o aprueba</span><span><i className="mp-k" /> Registra o trabaja</span><span><i className="mp-k mp-kV" /> Consulta</span>
            <span style={{ color: "var(--mp-earth)" }}>◆ Punto de decisión</span><span>→ El dato pasa de un módulo a otro</span>
          </div>
        </div>
        {(lateral || hoja) && <Panel e={e} ir={(id) => set({ sel: id })} limpiar={() => set({ sel: null })} />}
      </div>
      <section className="mp-down" aria-labelledby="mp-lam">
        <h2 id="mp-lam">Láminas para imprimir</h2>
        <p className="mp-muted" style={{ fontSize: 14 }}>PDF de una página, en vector. Las completas están pensadas para A2 y las resumidas para A3; también se pueden reducir al tamaño de tu impresora.</p>
        <ul>{LAMINAS.map((l) => <li key={l.f}><a href={`/mapa-proceso/${l.f}`} target="_blank" rel="noreferrer">{l.t}</a></li>)}</ul>
      </section>
    </div>
  );
}

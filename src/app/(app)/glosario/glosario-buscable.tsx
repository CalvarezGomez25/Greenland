"use client";

import { useState } from "react";
import type { Entrada } from "@/lib/glosario";
import type { Guia } from "@/lib/guias";

type Termino = Entrada & { categoria: string };

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GlosarioBuscable({ terminos, guias }: { terminos: Termino[]; guias: Guia[] }) {
  const [q, setQ] = useState("");
  const f = normalizar(q.trim());
  const coincideT = (t: Termino) => !f || normalizar(`${t.titulo} ${t.texto} ${t.ejemplo ?? ""} ${t.meta ?? ""}`).includes(f);
  const coincideG = (g: Guia) => !f || normalizar(`${g.titulo} ${g.quien} ${g.pasos.join(" ")} ${(g.notas ?? []).join(" ")}`).includes(f);
  const ts = terminos.filter(coincideT);
  const gs = guias.filter(coincideG);
  const categorias = [...new Set(ts.map((t) => t.categoria))];

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar una sigla, un indicador o un módulo…" aria-label="Buscar en el glosario y las guías"
          className="h-10 w-full max-w-md rounded-[10px] border border-soil-border bg-white px-3.5 text-[15px] focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
        <nav aria-label="Secciones" className="flex gap-4 text-sm font-medium text-leaf-600">
          <a href="#terminos" className="hover:underline">Términos</a>
          <a href="#guias" className="hover:underline">Guías por módulo</a>
        </nav>
      </div>
      {f && ts.length === 0 && gs.length === 0 && <p className="mt-6 rounded-card bg-leaf-50 p-5 text-sm text-muted">Nada coincide con «{q}».</p>}

      {ts.length > 0 && (
        <section id="terminos" className="mt-8 scroll-mt-4" aria-labelledby="t-terminos">
          <h2 id="t-terminos" className="font-display text-2xl font-bold text-leaf-700">Términos e indicadores</h2>
          {categorias.map((c) => (
            <div key={c} className="mt-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-leaf-800">{c}</h3>
              <dl className="divide-y divide-soil-border rounded-card border border-soil-border">
                {ts.filter((t) => t.categoria === c).map((t) => (
                  <div key={t.titulo} className="grid gap-1 p-4 sm:grid-cols-[16rem_1fr] sm:gap-4">
                    <dt className="font-medium text-leaf-900">{t.titulo}</dt>
                    <dd className="text-sm">
                      {t.texto}
                      {t.ejemplo && <span className="mt-1.5 block rounded-lg bg-leaf-50 px-2.5 py-1.5 text-leaf-800"><b>Ejemplo:</b> {t.ejemplo}</span>}
                      {t.meta && <span className="mt-1.5 block text-muted">{t.meta}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}

      {gs.length > 0 && (
        <section id="guias" className="mt-10 scroll-mt-4" aria-labelledby="t-guias">
          <h2 id="t-guias" className="font-display text-2xl font-bold text-leaf-700">Cómo diligenciar cada módulo</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {gs.map((g) => (
              <article key={g.clave} id={`guia-${g.clave}`} className="scroll-mt-4 rounded-card border border-soil-border p-5 target:border-leaf-600 target:ring-2 target:ring-leaf-500/40">
                <h3 className="font-display text-lg font-bold text-leaf-700">{g.titulo}</h3>
                <p className="mt-0.5 text-xs text-muted"><b>Quién:</b> {g.quien}</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">{g.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                {g.notas?.map((n, i) => <p key={i} className="mt-3 rounded-lg bg-leaf-50 px-3 py-2 text-xs text-leaf-800">{n}</p>)}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

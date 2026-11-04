"use client";

import { useMemo, useState } from "react";
import { enlaceCorreo } from "@/lib/correo/borradores";
import { claseBoton, claseCampo } from "@/components/ui";

type Tercero = { id: string; nombre: string; correo: string };

// Arma un borrador de invitación para los aliados que elijas. Se abre en tu programa de correo, con los destinatarios en
// copia oculta (Cco); la plataforma no envía nada.
export function InvitarPorCorreo({ terceros, asunto, cuerpo }: { terceros: Tercero[]; asunto: string; cuerpo: string }) {
  const [q, setQ] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return terceros.filter((x) => !t || x.nombre.toLowerCase().includes(t) || x.correo.toLowerCase().includes(t)).slice(0, 40);
  }, [q, terceros]);
  const alternar = (id: string) => setElegidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const correos = terceros.filter((t) => elegidos.has(t.id)).map((t) => t.correo);
  const href = enlaceCorreo({ cco: correos, asunto, cuerpo });
  return (
    <div className="flex flex-col gap-3">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un aliado por nombre o correo" aria-label="Buscar aliados con correo" className={`${claseCampo} max-w-sm`} />
      {terceros.length === 0 ? (
        <p className="text-sm text-muted">Ningún aliado activo tiene correo de notificación. Agrégalo en su ficha de RAIZ.</p>
      ) : (
        <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-card border border-soil-border bg-white p-2 sm:grid-cols-2">
          {visibles.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-leaf-50">
                <input type="checkbox" checked={elegidos.has(t.id)} onChange={() => alternar(t.id)} className="mt-1" />
                <span><span className="font-medium text-leaf-900">{t.nombre}</span><span className="block text-xs text-muted">{t.correo}</span></span>
              </label>
            </li>
          ))}
          {visibles.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">Ningún aliado coincide.</li>}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {href ? <a href={href} className={claseBoton.primario}>Abrir borrador de correo ({correos.length})</a> : <span className={`${claseBoton.primario} opacity-45`} aria-disabled>Abrir borrador de correo</span>}
        <p className="text-xs text-muted">Los correos van en copia oculta (Cco). Revisa el mensaje y envíalo desde tu cuenta: la plataforma no envía nada.</p>
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioValor({ clave, valor, accion }: { clave: string; valor: string; accion: (a: Estado, d: FormData) => Promise<Estado> }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="ambito" value="global" />
      <input type="hidden" name="clave" value={clave} />
      <Campo etiqueta="Valor" name="valor" defaultValue={valor} required maxLength={500} className="min-w-[160px] flex-1" />
      <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">Guardar</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
      {estado.valores?.guardado && <span className="text-xs text-leaf-700">Guardado</span>}
    </form>
  );
}

export function FormularioAjuste({
  claves, portafolios, proyectos, accion,
}: {
  claves: string[];
  portafolios: { id: string; nombre: string }[];
  proyectos: { id: string; nombre: string }[];
  accion: (a: Estado, d: FormData) => Promise<Estado>;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Selector etiqueta="Parámetro" name="clave" required defaultValue={estado.valores?.clave ?? ""}>
        <option value="">Elige…</option>
        {claves.map((c) => <option key={c} value={c}>{c}</option>)}
      </Selector>
      <Campo etiqueta="Valor" name="valor" required maxLength={500} defaultValue={estado.valores?.valor ?? ""} />
      <Selector etiqueta="Aplica a" name="ambito" defaultValue={estado.valores?.ambito ?? "proyecto"}>
        <option value="proyecto">Un proyecto</option>
        <option value="portafolio">Un portafolio</option>
      </Selector>
      <Selector etiqueta="Cuál" name="destino" required defaultValue={estado.valores?.destino ?? ""}>
        <option value="">Elige…</option>
        <optgroup label="Proyectos">{proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>
        <optgroup label="Portafolios">{portafolios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup>
      </Selector>
      {estado.error && <div className="sm:col-span-2"><Aviso>{estado.error}</Aviso></div>}
      {estado.valores?.guardado && <div className="sm:col-span-2"><Aviso tipo="ok">Ajuste guardado.</Aviso></div>}
      <div className="sm:col-span-2"><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar ajuste</BotonEnviar></div>
    </form>
  );
}

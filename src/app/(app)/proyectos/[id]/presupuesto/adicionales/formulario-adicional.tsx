"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioAdicional({
  accion,
  elementos,
  cambios,
  inicial = {},
  textoBoton,
  volver,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  elementos: { id: string; etiqueta: string }[];
  cambios: { id: string; etiqueta: string }[];
  inicial?: Record<string, string>;
  textoBoton: string;
  volver: string;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (clave: string) => estado.valores?.[clave] ?? inicial[clave] ?? "";
  const aplica = estado.valores ? estado.valores.aplica_indirectos === "on" : (inicial.aplica_indirectos ?? "on") === "on";

  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-xl flex-col gap-4">
      <Campo etiqueta="Descripción del trabajo" name="descripcion" required maxLength={500} defaultValue={v("descripcion")} />
      <Selector etiqueta="Origen" name="origen" required defaultValue={v("origen") || "no_contemplado"}>
        <option value="no_contemplado">No contemplado en la EDT original</option>
        <option value="anadidura">Añadidura durante la ejecución</option>
      </Selector>
      <Campo etiqueta="Valor directo (COP)" name="valor" required inputMode="decimal" defaultValue={v("valor")} ayuda="Costo directo del trabajo, sin A.I.U. Con coma decimal si la necesitas." />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="aplica_indirectos" defaultChecked={aplica} className="mt-1" />
        <span>Aplicar los costos indirectos (A.I.U.) del proyecto a este adicional.</span>
      </label>
      <Selector etiqueta="Elemento de la EDT (opcional)" name="wbs" defaultValue={v("wbs")}>
        <option value="">Sin elemento</option>
        {elementos.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
      </Selector>
      <Selector etiqueta="Cambio que lo respalda (opcional)" name="cambio" defaultValue={v("cambio")} ayuda="El adicional queda «Aprobado» cuando ese cambio se aprueba en el control de cambios; mientras tanto está «En trámite» y no cuenta en el balance.">
        <option value="">Sin cambio</option>
        {cambios.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
      </Selector>
      <Campo etiqueta="Nota (opcional)" name="nota" maxLength={1000} defaultValue={v("nota")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">{textoBoton}</BotonEnviar>
        <Link href={volver} className={claseBoton.contorno}>Cancelar</Link>
      </div>
    </form>
  );
}

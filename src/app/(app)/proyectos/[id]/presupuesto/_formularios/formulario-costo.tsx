"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioCosto({
  accion,
  opcionesBase,
  inicial = {},
  textoBoton,
  volver,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  opcionesBase: { id: string; nombre: string }[]; // otras líneas sobre las que se puede calcular
  inicial?: Record<string, string>;
  textoBoton: string;
  volver: string;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (clave: string) => estado.valores?.[clave] ?? inicial[clave] ?? "";

  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-xl flex-col gap-4">
      <Campo etiqueta="Concepto" name="nombre" required maxLength={80} defaultValue={v("nombre")} ayuda="Por ejemplo Administración, Imprevistos, Utilidad, IVA sobre la utilidad, Retefuente." />
      <Selector etiqueta="Se calcula sobre" name="base" required defaultValue={v("base") || "costo_directo"}>
        <option value="costo_directo">Costo directo</option>
        {opcionesBase.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Porcentaje (%)"
        name="porcentaje"
        required
        inputMode="decimal"
        defaultValue={v("porcentaje")}
        ayuda="Entre 0 y 100, con coma decimal (por ejemplo 3,5). Hasta 4 decimales."
      />
      <Campo etiqueta="Motivo del cambio (opcional)" name="motivo" maxLength={500} defaultValue={v("motivo")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">
          {textoBoton}
        </BotonEnviar>
        <Link href={volver} className={claseBoton.contorno}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

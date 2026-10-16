"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioContacto({
  accion,
  iniciales,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  iniciales: Record<string, string>;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-xl flex-col gap-4">
      <Campo etiqueta="Nombre u organización" name="nombre" required maxLength={200} defaultValue={v("nombre")} />
      <Campo etiqueta="Cargo o rol habitual (opcional)" name="rol" maxLength={200} defaultValue={v("rol")} />
      <Campo etiqueta="Correo electrónico (opcional)" name="correo" type="email" maxLength={200} defaultValue={v("correo")} ayuda="Un correo identifica a una sola persona en el directorio." />
      <Campo etiqueta="Teléfono (opcional)" name="telefono" type="tel" maxLength={40} defaultValue={v("telefono")} ayuda="Por ejemplo +57 300 123 4567." />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar>
        <Link href="/directorio" className={claseBoton.contorno}>Cancelar</Link>
      </div>
    </form>
  );
}

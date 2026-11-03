"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioContratante({ accion, iniciales, soloLectura = false }: { accion: (a: Estado, d: FormData) => Promise<Estado>; iniciales: Record<string, string>; soloLectura?: boolean }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-2xl flex-col gap-4">
      <fieldset disabled={soloLectura} className="flex flex-col gap-4">
        <Campo etiqueta="Razón social" name="razon_social" required maxLength={200} defaultValue={v("razon_social")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="NIT (opcional)" name="nit" maxLength={30} defaultValue={v("nit")} ayuda="Con el dígito de verificación: 901902573-8." />
          <Campo etiqueta="Municipio (opcional)" name="municipio" maxLength={100} defaultValue={v("municipio")} />
          <Campo etiqueta="Correo de notificación (opcional)" name="correo_notificacion" type="email" maxLength={200} defaultValue={v("correo_notificacion")} />
          <Campo etiqueta="Correo de facturación (opcional)" name="correo_facturacion" type="email" maxLength={200} defaultValue={v("correo_facturacion")} />
        </div>
        <Campo etiqueta="Representante legal (opcional)" name="representante_legal" maxLength={200} defaultValue={v("representante_legal")} />
        <Campo etiqueta="Tope de contratación sin asamblea, en SMMLV (opcional)" name="tope_smmlv" inputMode="numeric" maxLength={6} defaultValue={v("tope_smmlv")} ayuda="Si lo dejas vacío se usa el parámetro general «tope_asamblea_smmlv»." />
        <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={1000} defaultValue={v("observaciones")} />
        <Selector etiqueta="Estado" name="estado" defaultValue={v("estado") || "activo"}>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Selector>
      </fieldset>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        {!soloLectura && <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar>}
        <Link href="/aliados/contratantes" className={claseBoton.contorno}>{soloLectura ? "Volver" : "Cancelar"}</Link>
      </div>
    </form>
  );
}

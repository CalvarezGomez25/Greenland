"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { ETIQUETA_TIPO_PERSONA, ETIQUETA_TIPO_TERCERO } from "@/lib/aliados";

export function FormularioTercero({ accion, iniciales, soloLectura = false }: { accion: (a: Estado, d: FormData) => Promise<Estado>; iniciales: Record<string, string>; soloLectura?: boolean }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-2xl flex-col gap-4">
      <fieldset disabled={soloLectura} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="NIT o cédula" tema="nit_tercero" name="nit" required maxLength={30} defaultValue={v("nit")} ayuda="Con o sin puntos; con el dígito de verificación si lo tiene (901519601-4). Sin RUT todavía: PEND-NOMBRE." />
          <Selector etiqueta="Tipo de persona" name="tipo_persona" required defaultValue={v("tipo_persona") || "juridica"}>
            {Object.entries(ETIQUETA_TIPO_PERSONA).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </Selector>
        </div>
        <Campo etiqueta="Razón social o nombre" name="razon_social" required maxLength={200} defaultValue={v("razon_social")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Tipo de tercero" tema="tipo_tercero" name="tipo_tercero" required defaultValue={v("tipo_tercero") || "contratista"}>
            {Object.entries(ETIQUETA_TIPO_TERCERO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </Selector>
          <Campo etiqueta="Especialidad (opcional)" name="especialidad" maxLength={200} defaultValue={v("especialidad")} />
          <Campo etiqueta="Municipio (opcional)" name="municipio" maxLength={100} defaultValue={v("municipio")} />
          <Campo etiqueta="Dirección (opcional)" name="direccion" maxLength={200} defaultValue={v("direccion")} />
          <Campo etiqueta="Correo de notificación (opcional)" name="correo_notificacion" type="email" maxLength={200} defaultValue={v("correo_notificacion")} />
          <Campo etiqueta="Teléfono (opcional)" name="telefono" type="tel" maxLength={40} defaultValue={v("telefono")} />
        </div>
        <Campo etiqueta="Representante legal (opcional)" name="representante_legal" maxLength={200} defaultValue={v("representante_legal")} ayuda="Solo el nombre. No se guardan cédulas ni documentos: para eso se usa el enlace al soporte." />
        <Campo etiqueta="Fuente o enlace al soporte (opcional)" name="fuente" maxLength={300} defaultValue={v("fuente")} ayuda="De dónde salió el dato (por ejemplo, el enlace al RUT en OneDrive)." />
        <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={1000} defaultValue={v("observaciones")} />
        <Selector etiqueta="Estado" name="estado" defaultValue={v("estado") || "activo"} ayuda="Un tercero no se borra: se marca inactivo y deja de aparecer al registrar contratos nuevos.">
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Selector>
      </fieldset>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        {!soloLectura && <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar>}
        <Link href="/aliados" className={claseBoton.contorno}>{soloLectura ? "Volver" : "Cancelar"}</Link>
      </div>
    </form>
  );
}

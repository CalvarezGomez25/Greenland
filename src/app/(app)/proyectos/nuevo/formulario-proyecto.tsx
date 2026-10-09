"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearProyecto, type EstadoProyecto } from "./acciones";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";

export type ValoresProyecto = {
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  duracion_meses: number;
};

// Sirve para crear (sin `inicial`) y para editar (con `inicial` y la acción de edición).
export function FormularioProyecto({
  inicial,
  accionServidor = crearProyecto,
  textoBoton = "Crear proyecto",
  textoEnviando = "Creando…",
  volverA = "/",
}: {
  inicial?: ValoresProyecto;
  accionServidor?: (anterior: EstadoProyecto, datos: FormData) => Promise<EstadoProyecto>;
  textoBoton?: string;
  textoEnviando?: string;
  volverA?: string;
}) {
  const [estado, accion] = useActionState<EstadoProyecto, FormData>(accionServidor, {});

  return (
    <form action={accion} className="flex max-w-xl flex-col gap-4">
      <Campo etiqueta="Nombre del proyecto" name="nombre" defaultValue={inicial?.nombre} required maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cliente (opcional)" name="cliente" defaultValue={inicial?.cliente ?? ""} maxLength={120} />
        <Campo etiqueta="Ubicación (opcional)" name="ubicacion" defaultValue={inicial?.ubicacion ?? ""} maxLength={160} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha de inicio" name="fecha_inicio" type="date" defaultValue={inicial?.fecha_inicio} required />
        <Campo
          etiqueta="Duración (meses)"
          name="duracion_meses"
          defaultValue={inicial?.duracion_meses}
          type="number"
          min={1}
          max={120}
          step={1}
          inputMode="numeric"
          required
          ayuda="Entre 1 y 120 meses."
        />
      </div>
      <p className="text-sm text-muted">La moneda de la plataforma es el peso colombiano (COP).</p>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando={textoEnviando}>
          {textoBoton}
        </BotonEnviar>
        <Link href={volverA} className={claseBoton.contorno}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

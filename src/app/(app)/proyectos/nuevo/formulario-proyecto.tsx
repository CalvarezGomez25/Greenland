"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearProyecto, type EstadoProyecto } from "./acciones";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";

export function FormularioProyecto() {
  const [estado, accion] = useActionState<EstadoProyecto, FormData>(crearProyecto, {});

  return (
    <form action={accion} className="flex max-w-xl flex-col gap-4">
      <Campo etiqueta="Nombre del proyecto" name="nombre" required maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cliente (opcional)" name="cliente" maxLength={120} />
        <Campo etiqueta="Ubicación (opcional)" name="ubicacion" maxLength={160} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha de inicio" name="fecha_inicio" type="date" required />
        <Campo
          etiqueta="Duración (meses)"
          name="duracion_meses"
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
        <BotonEnviar className={claseBoton.primario} textoEnviando="Creando…">
          Crear proyecto
        </BotonEnviar>
        <Link href="/" className={claseBoton.contorno}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

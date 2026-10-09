"use client";

import { useActionState } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";

export function FormularioIngreso() {
  const [estado, accion] = useActionState<EstadoIngreso, FormData>(ingresar, {});

  return (
    <form action={accion} key={estado.correo ?? ""} className="flex flex-col gap-4">
      <Campo
        etiqueta="Correo"
        name="correo"
        type="email"
        autoComplete="username"
        defaultValue={estado.correo ?? ""}
        required
      />
      <Campo
        etiqueta="Contraseña"
        name="clave"
        type="password"
        autoComplete="current-password"
        required
      />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <BotonEnviar className={claseBoton.primario} textoEnviando="Ingresando…">
        Ingresar
      </BotonEnviar>
    </form>
  );
}

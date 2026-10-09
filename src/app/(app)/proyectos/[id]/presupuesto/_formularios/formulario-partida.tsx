"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioPartida({
  accion,
  capitulos,
  inicial = {},
  textoBoton,
  volver,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  capitulos: string[];
  inicial?: Record<string, string>;
  textoBoton: string;
  volver: string;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (clave: string) => estado.valores?.[clave] ?? inicial[clave] ?? "";

  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-2xl flex-col gap-4">
      <Campo
        etiqueta="Capítulo"
        name="capitulo"
        list="lista-capitulos"
        required
        maxLength={120}
        defaultValue={v("capitulo")}
        ayuda="Elige uno existente o escribe un nombre nuevo: el capítulo se crea solo."
      />
      <datalist id="lista-capitulos">
        {capitulos.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Código" name="codigo" required maxLength={40} defaultValue={v("codigo")} />
        <Campo etiqueta="Unidad" name="unidad" required maxLength={20} defaultValue={v("unidad")} ayuda="Por ejemplo m2, m3, kg, gl." />
      </div>
      <Campo etiqueta="Descripción" name="descripcion" required maxLength={300} defaultValue={v("descripcion")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Cantidad"
          name="cantidad"
          required
          inputMode="decimal"
          defaultValue={v("cantidad")}
          ayuda="Formato colombiano: punto para miles y coma para decimales (1.234,56). Hasta 4 decimales."
        />
        <Campo
          etiqueta="Precio unitario (COP)"
          name="precio"
          required
          inputMode="decimal"
          defaultValue={v("precio")}
          ayuda="Hasta 2 decimales."
        />
      </div>
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

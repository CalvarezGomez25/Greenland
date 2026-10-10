"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearProyecto, type EstadoProyecto } from "./acciones";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import { ETIQUETA_ESTADO, ETIQUETA_FASE, ETIQUETA_TIPO } from "@/lib/tipos";

export type ValoresProyecto = {
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  duracion_meses: number;
  tipo?: string;
  fase?: string;
  estado?: string;
  usa_obra?: boolean;
  codigo?: string | null;
  organizacion_id?: string | null;
  portafolio_id?: string | null;
};

export type OpcionesFicha = {
  organizaciones: { id: string; nombre: string }[];
  portafolios: { id: string; nombre: string; organizacion_id: string }[];
  esAdmin: boolean; // el administrador cambia además código, organización y portafolio
};

// Sirve para crear (sin `inicial`) y para editar (con `inicial` y la acción de edición).
export function FormularioProyecto({
  inicial,
  ficha,
  accionServidor = crearProyecto,
  textoBoton = "Crear proyecto",
  textoEnviando = "Creando…",
  volverA = "/",
}: {
  inicial?: ValoresProyecto;
  ficha?: OpcionesFicha;
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

      {ficha && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selector etiqueta="Tipo de proyecto" name="tipo" defaultValue={inicial?.tipo ?? "obra_civil"}>
              {Object.entries(ETIQUETA_TIPO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selector>
            <Selector etiqueta="Fase" name="fase" defaultValue={inicial?.fase ?? "inicio"}>
              {Object.entries(ETIQUETA_FASE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selector>
            <Selector etiqueta="Estado" name="estado" defaultValue={inicial?.estado ?? "activo"}>
              {/* «Cerrado» no se elige aquí: el cierre y la reapertura se hacen desde el módulo Cierre */}
              {Object.entries(ETIQUETA_ESTADO).filter(([v]) => v !== "cerrado" || inicial?.estado === "cerrado").map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selector>
          </div>
          <label className="flex items-center gap-2 text-sm text-leaf-900">
            <input type="checkbox" name="usa_obra" defaultChecked={inicial?.usa_obra ?? true} className="h-4 w-4" />
            Usa el área de Obra (presupuesto, cronograma, contratos y bitácora)
          </label>
          {ficha.esAdmin && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Código" name="codigo" defaultValue={inicial?.codigo ?? ""} maxLength={30} ayuda="Se genera solo si lo dejas vacío." />
              <Selector etiqueta="Organización" name="organizacion_id" defaultValue={inicial?.organizacion_id ?? ficha.organizaciones[0]?.id ?? ""}>
                {ficha.organizaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </Selector>
              <Selector etiqueta="Portafolio" name="portafolio_id" defaultValue={inicial?.portafolio_id ?? ficha.portafolios[0]?.id ?? ""}>
                {ficha.portafolios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Selector>
            </div>
          )}
        </>
      )}

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

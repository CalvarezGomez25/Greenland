import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { guardarParametro, quitarAjuste } from "./acciones";
import { FormularioAjuste, FormularioValor } from "./formulario-parametro";

type Par = { id: string; ambito: string; ambito_id: string | null; clave: string; valor: string; descripcion: string | null; fuente: string | null };

async function Contenido() {
  const { supabase, perfil } = await obtenerSesion();
  const esAdmin = perfil?.rol_global === "administrador";
  const [{ data }, { data: portafolios }, { data: proyectos }] = await Promise.all([
    supabase.from("parametros").select("id, ambito, ambito_id, clave, valor, descripcion, fuente").order("clave"),
    supabase.from("portafolios").select("id, nombre").order("nombre"),
    supabase.from("proyectos").select("id, nombre").order("nombre"),
  ]);
  const pars = (data ?? []) as Par[];
  if (pars.length === 0 && !esAdmin) redirect("/");
  const globales = pars.filter((p) => p.ambito === "global");
  const ajustes = pars.filter((p) => p.ambito !== "global");
  const nombre = (p: Par) =>
    ((p.ambito === "proyecto" ? proyectos : portafolios) ?? []).find((x) => x.id === p.ambito_id)?.nombre ?? "—";

  return (
    <>
      <Titulo>Parámetros</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Umbrales y reglas de la plataforma. Prevalece el ajuste del proyecto sobre el del portafolio, y este sobre el global.
        {esAdmin ? " Todo cambio queda en la auditoría." : " Solo el administrador puede cambiarlos."}
      </p>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold text-leaf-700">Valores globales</h2>
        <ul className="mt-4 divide-y divide-soil-border rounded-card border border-soil-border">
          {globales.map((p) => (
            <li key={p.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_minmax(260px,360px)] sm:items-end">
              <div>
                <p className="font-mono text-sm font-medium text-leaf-900">{p.clave}</p>
                <p className="text-sm text-muted">{p.descripcion}</p>
                {p.fuente && <p className="text-xs text-muted">Fuente: {p.fuente}</p>}
              </div>
              {esAdmin ? (
                <FormularioValor clave={p.clave} valor={p.valor} accion={guardarParametro} />
              ) : (
                <p className="text-sm font-medium text-leaf-900">{p.valor}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-leaf-700">Ajustes por portafolio o proyecto</h2>
        {ajustes.length === 0 ? (
          <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">No hay ajustes. Todos los proyectos usan los valores globales.</p>
        ) : (
          <ul className="mt-4 divide-y divide-soil-border rounded-card border border-soil-border">
            {ajustes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  <span className="font-mono font-medium">{p.clave}</span> = <strong>{p.valor}</strong>
                  <span className="text-muted"> · {p.ambito === "proyecto" ? "Proyecto" : "Portafolio"}: {nombre(p)}</span>
                </span>
                {esAdmin && (
                  <form action={quitarAjuste.bind(null, p.id)}>
                    <BotonEnviar className={claseBoton.peligro} textoEnviando="Quitando…">Quitar</BotonEnviar>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {esAdmin && (
          <div className="mt-6 rounded-card bg-leaf-50 p-5">
            <h3 className="mb-3 font-display text-lg font-bold text-leaf-700">Agregar un ajuste</h3>
            <FormularioAjuste
              claves={globales.map((g) => g.clave)}
              portafolios={(portafolios ?? []) as { id: string; nombre: string }[]}
              proyectos={(proyectos ?? []) as { id: string; nombre: string }[]}
              accion={guardarParametro}
            />
          </div>
        )}
      </section>
    </>
  );
}

export default function PaginaParametros() {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido /></Suspense>;
}

import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { ETIQUETA_ROL_GLOBAL, type RolProyecto } from "@/lib/tipos";
import { claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { BarraLateral } from "@/components/barra-lateral";
import { armarProyectosNav, enlacesAdministracion, puedeUsarDirectorio } from "@/lib/navegacion";
import { NOMBRE_PLATAFORMA } from "@/lib/marca";
import { cambiarUsuario, salir } from "./acciones";

async function MenuLateral() {
  const { supabase, perfil } = await obtenerSesion();
  const [{ data: proyectos }, { data: miembros }] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, codigo, estado, usa_obra").order("nombre"),
    perfil ? supabase.from("miembros_proyecto").select("proyecto_id, rol").eq("usuario_id", perfil.id) : Promise.resolve({ data: [] }),
  ]);
  const roles = new Map(((miembros ?? []) as { proyecto_id: string; rol: RolProyecto }[]).map((m) => [m.proyecto_id, m.rol]));
  const rolGlobal = perfil?.rol_global ?? null;
  return (
    <BarraLateral
      proyectos={armarProyectosNav((proyectos ?? []) as { id: string; nombre: string; codigo: string | null; estado: string; usa_obra: boolean | null }[], roles, rolGlobal)}
      administracion={enlacesAdministracion(rolGlobal, puedeUsarDirectorio(rolGlobal, roles.values()))}
      puedeCrear={rolGlobal === "administrador"}
      conPortafolio={rolGlobal !== null}
      usuario={{ nombre: perfil?.nombre ?? "Usuario", rol: rolGlobal ? ETIQUETA_ROL_GLOBAL[rolGlobal] : null }}
      nombrePlataforma={NOMBRE_PLATAFORMA}
      cambiarUsuario={
        <form action={cambiarUsuario}>
          <button type="submit" title="Cambiar de usuario" aria-label="Cambiar de usuario" className="rounded-lg p-2 text-leaf-700 hover:bg-leaf-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf-600">
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h11l-3-3 M18 7l-3 3 M17 17H6l3 3 M6 17l3-3" /></svg>
          </button>
        </form>
      }
      salir={
        <form action={salir}>
          <BotonEnviar className={`${claseBoton.contorno} !h-9 w-full`} textoEnviando="Saliendo…">Salir</BotonEnviar>
        </form>
      }
    />
  );
}

export default function LayoutInterno({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      <Suspense fallback={<div className="h-12 border-b border-soil-border lg:h-auto lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0" />}>
        <MenuLateral />
      </Suspense>
      <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

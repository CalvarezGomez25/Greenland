import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { ETIQUETA_ROL_GLOBAL, type RolProyecto } from "@/lib/tipos";
import { claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { BarraLateral } from "@/components/barra-lateral";
import { armarProyectosNav, enlacesAdministracion } from "@/lib/navegacion";
import { NOMBRE_PLATAFORMA } from "@/lib/marca";
import { salir } from "./acciones";

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
      administracion={enlacesAdministracion(rolGlobal)}
      puedeCrear={rolGlobal === "administrador"}
      usuario={{ nombre: perfil?.nombre ?? "Usuario", rol: rolGlobal ? ETIQUETA_ROL_GLOBAL[rolGlobal] : null }}
      nombrePlataforma={NOMBRE_PLATAFORMA}
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

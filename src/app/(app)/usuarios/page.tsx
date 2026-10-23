import { Suspense } from "react";
import { exigirAdministrador } from "@/lib/sesion";
import { ETIQUETA_ROL_GLOBAL, ETIQUETA_ROL_PROYECTO, ROLES_GLOBALES, type RolProyecto } from "@/lib/tipos";
import { Selector, Titulo, claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { asignarRolGlobal } from "./acciones";

async function Contenido() {
  const { supabase, perfil } = await exigirAdministrador();
  const [{ data: perfiles }, { data: miembros }, { data: proyectos }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, correo, rol_global").order("nombre"),
    supabase.from("miembros_proyecto").select("proyecto_id, usuario_id, rol"),
    supabase.from("proyectos").select("id, nombre"),
  ]);
  const nombreProy = new Map(((proyectos ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const porUsuario = new Map<string, string[]>();
  for (const m of (miembros ?? []) as { proyecto_id: string; usuario_id: string; rol: RolProyecto }[]) {
    const l = porUsuario.get(m.usuario_id) ?? [];
    l.push(`${nombreProy.get(m.proyecto_id) ?? "—"} (${ETIQUETA_ROL_PROYECTO[m.rol]})`);
    porUsuario.set(m.usuario_id, l);
  }
  const lista = (perfiles ?? []) as { id: string; nombre: string; correo: string | null; rol_global: keyof typeof ETIQUETA_ROL_GLOBAL | null }[];

  return (
    <>
      <Titulo>Usuarios y roles</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        El rol global da acceso a todo el portafolio. Los roles por proyecto (gerente, supervisor, interventoría...) se asignan dentro de cada proyecto.
        Para invitar a una persona nueva, créala en Supabase → Authentication → Users → Invite user; aparecerá aquí.
      </p>
      <ul className="mt-6 divide-y divide-soil-border rounded-card border border-soil-border">
        {lista.map((u) => (
          <li key={u.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="font-medium text-leaf-900">{u.nombre}{u.id === perfil?.id ? " (tú)" : ""}</p>
              <p className="text-sm text-muted">{u.correo}</p>
              <p className="mt-1 text-xs text-muted">{(porUsuario.get(u.id) ?? []).join(" · ") || "Sin proyectos asignados"}</p>
            </div>
            {u.id === perfil?.id ? (
              <span className="rounded-full bg-leaf-100 px-3 py-0.5 text-xs font-medium text-leaf-800">{u.rol_global ? ETIQUETA_ROL_GLOBAL[u.rol_global] : "Sin rol global"}</span>
            ) : (
              <form action={asignarRolGlobal.bind(null, u.id)} className="flex items-end gap-2">
                <Selector etiqueta="Rol global" name="rol" defaultValue={u.rol_global ?? ""}>
                  <option value="">Sin rol global</option>
                  {ROLES_GLOBALES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL_GLOBAL[r]}</option>)}
                </Selector>
                <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">Guardar</BotonEnviar>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function PaginaUsuarios() {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido /></Suspense>;
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { rutaDeInicio } from "@/lib/navegacion";
import { Dashboard } from "./_tablero/tablero";

// Primera pantalla: el tablero de control del portafolio para quien ve todo el portafolio; para las demás personas,
// su espacio de trabajo («Mi trabajo»), con sus actividades pendientes a primera vista.
async function Inicio({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { perfil } = await obtenerSesion();
  if (perfil) {
    const inicio = rutaDeInicio(perfil.rol_global);
    if (inicio !== "/") redirect(inicio);
  }
  return <Dashboard searchParams={searchParams} base="/" />;
}

export default function PaginaInicio({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando el tablero…</p>}>
      <Inicio searchParams={searchParams} />
    </Suspense>
  );
}

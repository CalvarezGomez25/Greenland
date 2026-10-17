import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { rutaDelTablero } from "@/lib/navegacion";
import { Dashboard } from "../_tablero/tablero";

export const metadata = { title: "Tablero de mis proyectos · PMO360" };

// Tablero de control limitado a los proyectos de quien no ve todo el portafolio. Quien sí lo ve usa el tablero de «/».
async function TableroPropio({ searchParams }: { searchParams: PageProps<"/tablero">["searchParams"] }) {
  const { perfil } = await obtenerSesion();
  if (perfil && rutaDelTablero(perfil.rol_global) === "/") redirect("/");
  return <Dashboard searchParams={searchParams} base="/tablero" />;
}

export default function PaginaTableroPropio({ searchParams }: PageProps<"/tablero">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando el tablero…</p>}>
      <TableroPropio searchParams={searchParams} />
    </Suspense>
  );
}

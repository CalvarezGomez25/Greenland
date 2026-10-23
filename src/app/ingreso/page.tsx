import { Suspense } from "react";
import Image from "next/image";
import { LEMA_PLATAFORMA, NOMBRE_PLATAFORMA } from "@/lib/marca";
import { FormularioIngreso } from "./formulario-ingreso";

export default function PaginaIngreso() {
  return (
    <main className="flex flex-1 items-center justify-center bg-leaf-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-card">
        <Image
          src="/logo-greenland.png"
          alt="GreenLand"
          width={1737}
          height={528}
          className="mx-auto mb-6 h-auto w-48"
          priority
        />
        <h1 className="text-center font-display text-4xl font-bold tracking-tight text-leaf-500">
          {NOMBRE_PLATAFORMA}
        </h1>
        <p className="mb-6 mt-1 text-center font-display text-base font-medium text-leaf-700">{LEMA_PLATAFORMA}</p>
        <p className="mb-5 text-center text-sm text-muted">
          Ingresa con el correo y la contraseña que te asignó el administrador.
        </p>
        <Suspense fallback={null}><FormularioIngreso /></Suspense>
      </div>
    </main>
  );
}

import Image from "next/image";
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
        <h1 className="mb-1 text-center font-display text-2xl font-bold text-leaf-500">
          Plataforma de Obra
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Ingresa con el correo y la contraseña que te asignó el administrador.
        </p>
        <FormularioIngreso />
      </div>
    </main>
  );
}

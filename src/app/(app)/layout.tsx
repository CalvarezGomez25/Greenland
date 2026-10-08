import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { ETIQUETA_ROL_GLOBAL } from "@/lib/tipos";
import { claseBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { salir } from "./acciones";

async function DatosUsuario() {
  const { perfil } = await obtenerSesion();
  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right text-sm sm:block">
        <p className="font-medium text-leaf-900">{perfil?.nombre ?? "Usuario"}</p>
        {perfil?.rol_global && (
          <p className="text-xs text-muted">{ETIQUETA_ROL_GLOBAL[perfil.rol_global]}</p>
        )}
      </div>
      <form action={salir}>
        <BotonEnviar className={claseBoton.contorno} textoEnviando="Saliendo…">
          Salir
        </BotonEnviar>
      </form>
    </div>
  );
}

export default function LayoutInterno({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-soil-border bg-white">
        <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-6 py-3">
          <Link href="/" aria-label="Ir al inicio">
            <Image
              src="/logo-greenland.png"
              alt="GreenLand"
              width={1737}
              height={528}
              className="h-auto w-32"
              priority
            />
          </Link>
          <Suspense fallback={<div className="h-10 w-40" />}>
            <DatosUsuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1040px] flex-1 px-6 py-8">{children}</main>
    </>
  );
}

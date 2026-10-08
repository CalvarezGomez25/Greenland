import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { datosConexion } from "@/lib/supabase/env";

// Se ejecuta antes de cada página: renueva la sesión y manda a /ingreso a
// quien no ha iniciado sesión. La seguridad real de los datos NO depende de
// esto: la imponen las reglas de la base de datos y cada acción del servidor.
export async function proxy(request: NextRequest) {
  const { url, clave } = datosConexion();
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() valida la sesión contra el servidor de Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enIngreso = request.nextUrl.pathname === "/ingreso";
  let destino: string | null = null;
  if (!user && !enIngreso) destino = "/ingreso";
  if (user && enIngreso) destino = "/";

  if (destino) {
    const redireccion = NextResponse.redirect(new URL(destino, request.url));
    // conserva las cookies de sesión que se hayan renovado
    respuesta.cookies
      .getAll()
      .forEach((c) => redireccion.cookies.set(c.name, c.value));
    return redireccion;
  }

  return respuesta;
}

export const config = {
  matcher: [
    // todo, menos archivos estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

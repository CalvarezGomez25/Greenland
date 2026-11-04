import { Titulo } from "@/components/ui";
import { MapaProceso } from "./mapa";

export const metadata = { title: "Mapa de proceso · PMO360" };

export default function PaginaMapaProceso() {
  return (
    <>
      <Titulo>Mapa de proceso</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        El ciclo de vida de un proyecto de punta a punta: en qué etapa se usa cada módulo, quién interviene, quién decide y cómo pasan los datos de un módulo a otro. Haz clic en un módulo para descubrirlo.
      </p>
      <MapaProceso />
    </>
  );
}

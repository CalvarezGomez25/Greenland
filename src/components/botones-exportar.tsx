// Enlaces de descarga. `base` es la dirección de exportación (puede ya traer parámetros).
export function BotonesExportar({ base }: { base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  const clase = "inline-flex h-9 items-center rounded-full border-[1.5px] border-leaf-600 px-4 text-sm font-medium text-leaf-600 hover:bg-leaf-50";
  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-label="Exportar">
      <a href={`${base}${sep}formato=xlsx`} className={clase} download>Excel</a>
      <a href={`${base}${sep}formato=pdf`} className={clase} download>PDF</a>
    </span>
  );
}

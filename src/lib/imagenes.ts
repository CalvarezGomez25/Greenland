// Solo navegador: reduce una foto antes de subirla (los celulares entregan 4 a 12 MB por foto).
export async function comprimirImagen(archivo: File, ladoMaximo = 1600, calidad = 0.78): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) throw new Error(`“${archivo.name}” no es una imagen.`);
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
  if (!blob) throw new Error(`No se pudo preparar “${archivo.name}”.`);
  return blob;
}

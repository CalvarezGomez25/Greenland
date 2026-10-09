// Estado que devuelven las acciones de formulario. Incluye los valores escritos para que,
// si hay un error, el formulario no se vacíe (React 19 limpia los campos al terminar la acción).
export type Estado = { error?: string; valores?: Record<string, string> };

/** Serializa para inspeccionar en los tests: los ids de auditoría son BigInt y JSON no los soporta. */
export function serializar(valor: unknown): string {
  return JSON.stringify(valor, (_clave, dato: unknown) =>
    typeof dato === 'bigint' ? dato.toString() : dato,
  );
}

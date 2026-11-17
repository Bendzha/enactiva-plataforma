import {
  DIMENSIONES_VALORACION,
  ETIQUETAS_DIMENSION_VALORACION,
  type ValoracionesDeEmpresa,
} from '@enactiva/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useValoracionesPorEmpresa } from '@/lib/metricas';

interface Props {
  nombreDe: (empresaId: string) => string;
}

/**
 * Las estrellas promediadas, empresa por empresa (criterio 5 de SPEC §10).
 *
 * El promedio es **de la empresa**, nunca de una persona: quién valoró a quién no sale de aquí, y
 * el reconocimiento individual se ve dentro de cada organización.
 *
 * Una empresa que todavía no recibió valoraciones muestra una raya en el promedio y no un cero:
 * «sin datos» y «lo valoraron mal» no son lo mismo.
 */
export function ValoracionesPorEmpresa({ nombreDe }: Props) {
  const { data: valoraciones, isError } = useValoracionesPorEmpresa();

  if (isError) {
    return <Alert>No pudimos cargar las valoraciones. Actualiza la página.</Alert>;
  }
  if (!valoraciones) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardTitle>Valoración de los talleres</CardTitle>
      <CardDescription>
        Las cuatro preguntas que responde quien asistió, de 1 a 5 estrellas. Promediadas por
        empresa.
      </CardDescription>

      {valoraciones.empresas.length === 0 ? (
        <p className="mt-4 text-sm text-texto-suave">
          Todavía no termina ningún taller en el piloto. Esto se llena cuando quien asistió lo
          valore.
        </p>
      ) : (
        <table className="mt-4 w-full text-sm" aria-label="Valoración de los talleres">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-suave">
              <th className="pb-2 font-medium">Empresa</th>
              <th className="pb-2 text-right font-medium">Talleres valorados</th>
              <th className="pb-2 text-right font-medium">Valoraciones</th>
              <th className="pb-2 text-right font-medium">Promedio</th>
              {DIMENSIONES_VALORACION.map((dimension) => (
                <th key={dimension} className="pb-2 text-right font-medium">
                  {ETIQUETAS_DIMENSION_VALORACION[dimension]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valoraciones.empresas.map((empresa) => (
              <tr key={empresa.empresaId} className="border-b border-borde last:border-0">
                <td className="py-2 font-medium">{nombreDe(empresa.empresaId)}</td>
                <td className="py-2 text-right">
                  {empresa.talleresValorados} de {empresa.talleresTerminados}
                </td>
                <td className="py-2 text-right">{empresa.valoraciones}</td>
                <td className="py-2 text-right font-semibold">
                  {empresa.promedio === null ? (
                    <span className="font-normal text-texto-suave">—</span>
                  ) : (
                    `${empresa.promedio.toFixed(1)} ★`
                  )}
                </td>
                {DIMENSIONES_VALORACION.map((dimension) => (
                  <td key={dimension} className="py-2 text-right">
                    {promedioDe(empresa, dimension)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Una dimensión que nadie puntuó no viene en la respuesta: ahí va una raya, no un cero. */
function promedioDe(
  empresa: ValoracionesDeEmpresa,
  dimension: (typeof DIMENSIONES_VALORACION)[number],
) {
  const fila = empresa.porDimension.find((cada) => cada.dimension === dimension);
  return fila ? fila.estrellas.toFixed(1) : <span className="text-texto-suave">—</span>;
}

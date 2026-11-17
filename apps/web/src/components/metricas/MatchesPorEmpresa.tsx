import type { MatchesDeEmpresa } from '@enactiva/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useMatchesPorEmpresa } from '@/lib/metricas';

interface Props {
  /** Los nombres los sabe identity; aquí solo llegan ids (ADR-0007). */
  nombreDe: (empresaId: string) => string;
}

/**
 * Cómo están funcionando los matches, empresa por empresa (criterio 5 de SPEC §10).
 *
 * Los cuatro conteos van **sobre respuestas**, no sobre matches: un match puede traer dos, una
 * por parte. Por eso la tabla muestra el denominador en su propia columna, y los porcentajes se
 * calculan contra él y no contra los matches.
 *
 * Nunca dice quién respondió qué: la clienta pidió entender si los emparejamientos funcionan, no
 * auditar a cada persona.
 */
export function MatchesPorEmpresa({ nombreDe }: Props) {
  const { data: matches, isError } = useMatchesPorEmpresa();

  if (isError) {
    return <Alert>No pudimos cargar las puntuaciones de los matches. Actualiza la página.</Alert>;
  }
  if (!matches) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardTitle>Puntuación de los matches</CardTitle>
      <CardDescription>
        Las cuatro preguntas que contestan las dos partes después de reunirse. El porcentaje es
        sobre las respuestas recibidas, no sobre los matches.
      </CardDescription>

      {matches.empresas.length === 0 ? (
        <p className="mt-4 text-sm text-texto-suave">
          Todavía no hay matches en el piloto. Esto se llena cuando alguien acepte una tarjeta en
          Descubrir.
        </p>
      ) : (
        <table className="mt-4 w-full text-sm" aria-label="Puntuación de los matches">
          <thead>
            <tr className="border-b border-borde text-left text-xs text-texto-suave">
              <th className="pb-2 font-medium">Empresa</th>
              <th className="pb-2 text-right font-medium">Matches</th>
              <th className="pb-2 text-right font-medium">Puntuados</th>
              <th className="pb-2 text-right font-medium">Respuestas</th>
              <th className="pb-2 text-right font-medium">Se reunieron</th>
              <th className="pb-2 text-right font-medium">A la hora</th>
              <th className="pb-2 text-right font-medium">Como esperaban</th>
              <th className="pb-2 text-right font-medium">Repetirían</th>
            </tr>
          </thead>
          <tbody>
            {matches.empresas.map((empresa) => (
              <tr key={empresa.empresaId} className="border-b border-borde last:border-0">
                <td className="py-2 font-medium">{nombreDe(empresa.empresaId)}</td>
                <td className="py-2 text-right">{empresa.matches}</td>
                <td className="py-2 text-right">
                  {empresa.matchesConRespuesta} de {empresa.matches}
                </td>
                <td className="py-2 text-right">{empresa.respuestas}</td>
                <Porcentaje de={empresa} campo="seReunieron" />
                <Porcentaje de={empresa} campo="aLaHoraAcordada" />
                <Porcentaje de={empresa} campo="comoLoEsperaban" />
                <Porcentaje de={empresa} campo="repetirian" />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

type Pregunta = 'seReunieron' | 'aLaHoraAcordada' | 'comoLoEsperaban' | 'repetirian';

/**
 * Una celda con el porcentaje y el conteo.
 *
 * Sin respuestas muestra una raya y no «0 %»: nadie contestó todavía, que no es lo mismo que
 * haber contestado que no (T13.4).
 */
function Porcentaje({ de, campo }: { de: MatchesDeEmpresa; campo: Pregunta }) {
  if (de.respuestas === 0) {
    return <td className="py-2 text-right text-texto-suave">—</td>;
  }

  const cuantos = de[campo];
  return (
    <td className="py-2 text-right">
      <span className="font-semibold">{Math.round((cuantos / de.respuestas) * 100)}%</span>{' '}
      <span className="text-xs text-texto-suave">
        ({cuantos}/{de.respuestas})
      </span>
    </td>
  );
}

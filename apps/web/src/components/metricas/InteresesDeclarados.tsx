import type { TemaDemanda } from '@enactiva/shared';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useMetricasIntereses } from '@/lib/metricas';

/**
 * Lo que RRHH necesita saber de los perfiles de su gente: cuántos están completos y, sobre todo,
 * qué está pidiendo la organización que nadie adentro puede enseñar todavía.
 *
 * Son conteos, nunca nombres: para decidir dónde traer formación basta el número.
 */
export function InteresesDeclarados() {
  const { data: metricas, isPending } = useMetricasIntereses();

  if (isPending || !metricas) {
    return null;
  }

  const sinDatos = metricas.declaraciones === 0;

  return (
    <Card className="mb-6">
      <CardTitle>Qué quiere aprender tu gente</CardTitle>
      <CardDescription>
        {metricas.personasConPerfil} de {metricas.personasActivas} personas ya declararon sus temas
        · {metricas.temas} temas en el catálogo
      </CardDescription>

      {sinDatos ? (
        <p className="mt-4 text-sm text-texto-suave">
          Todavía nadie declaró sus temas. Esto se llena cuando tu gente complete su perfil.
        </p>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Columna
            titulo="Nadie puede enseñarlo todavía"
            ayuda="Aquí es donde hace falta traer formación de afuera."
            temas={metricas.brechas}
            cuenta={(tema) =>
              plural(tema.quierenAprender, 'quiere aprenderlo', 'quieren aprenderlo')
            }
            vacio="Hay alguien que puede enseñar todo lo que se pidió."
          />
          <Columna
            titulo="Lo que más se ofrece"
            ayuda="Gente de la casa que ya puede hacer un taller."
            temas={metricas.masOfrecidos}
            cuenta={(tema) => plural(tema.puedenEnsenar, 'puede enseñarlo', 'pueden enseñarlo')}
            vacio="Nadie declaró todavía algo que pueda enseñar."
          />
        </div>
      )}
    </Card>
  );
}

/** "1 quiere aprenderlo" y no "1 quieren aprenderlo": la pantalla la lee gente, no un reporte. */
function plural(cuantos: number, singular: string, plural: string): string {
  return `${cuantos} ${cuantos === 1 ? singular : plural}`;
}

interface ColumnaProps {
  titulo: string;
  ayuda: string;
  temas: TemaDemanda[];
  cuenta: (tema: TemaDemanda) => string;
  vacio: string;
}

function Columna({ titulo, ayuda, temas, cuenta, vacio }: ColumnaProps) {
  return (
    <div>
      <h3 className="text-sm font-bold">{titulo}</h3>
      <p className="mb-2 text-xs text-texto-suave">{ayuda}</p>

      {temas.length === 0 ? (
        <p className="text-sm text-texto-suave">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {temas.map((tema) => (
            <li key={tema.temaId} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{tema.nombre}</span>
              <span className="text-xs text-texto-suave">{cuenta(tema)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

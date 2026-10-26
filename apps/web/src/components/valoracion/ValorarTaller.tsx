import {
  DIMENSIONES_VALORACION,
  ETIQUETAS_DIMENSION_VALORACION,
  ETIQUETAS_PREGUNTA_MATCH,
  MAXIMO_REFERENCIA,
  PREGUNTAS_MATCH,
  type DimensionValoracion,
  type PuntuarMatchInput,
} from '@enactiva/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usePuntuarMatch, useValorarTaller } from '@/lib/valoracion';
import { Estrellas } from './Estrellas';

interface ValorarTallerProps {
  tallerId: string;
  tallerNombre: string;
  /** Si este taller además tiene un match pendiente de puntuar, se pregunta a continuación. */
  conMatchPendiente: boolean;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}

type Estrellitas = Record<DimensionValoracion, number>;
const SIN_RESPONDER = 0;

const VACIAS: Estrellitas = {
  CLARIDAD: SIN_RESPONDER,
  SEGURIDAD: SIN_RESPONDER,
  APLICACION: SIN_RESPONDER,
  USO_DE_MATERIALES: SIN_RESPONDER,
};

/**
 * Lo que se pregunta al cerrar un taller (SPEC §3.5).
 *
 * Son dos pasos y no uno porque son dos cosas distintas: las estrellas dicen si el taller estuvo
 * bueno, y las cuatro preguntas del final si el **emparejamiento** funcionó. La clienta pidió
 * las dos, y mezclarlas haría ilegible justo el dato que ella quiere entender (ADR-0009).
 *
 * El segundo paso solo aparece si hay un match que puntuar: quien se inscribió desde Talleres,
 * sin pasar por Descubrir, no hizo match con nadie.
 */
export function ValorarTaller({
  tallerId,
  tallerNombre,
  conMatchPendiente,
  onCerrar,
  onListo,
}: ValorarTallerProps) {
  const valorar = useValorarTaller(tallerId);
  const puntuar = usePuntuarMatch(tallerId);

  const [paso, setPaso] = useState<'taller' | 'match'>('taller');
  const [estrellas, setEstrellas] = useState<Estrellitas>(VACIAS);
  const [asistio, setAsistio] = useState(true);
  const [referencia, setReferencia] = useState('');
  const [match, setMatch] = useState<Partial<PuntuarMatchInput>>({});

  const completas = DIMENSIONES_VALORACION.every(
    (dimension) => estrellas[dimension] !== SIN_RESPONDER,
  );
  const matchCompleto = PREGUNTAS_MATCH.every((pregunta) => match[pregunta] !== undefined);

  // Se atrapa el rechazo porque el mensaje ya se muestra desde `valorar.error`: sin esto, la
  // promesa escaparía del onClick y quedaría como un error sin manejar en la consola.
  const enviarValoracion = async () => {
    try {
      await valorar.mutateAsync({ estrellas, asistio, referencia: referencia.trim() });
    } catch {
      return;
    }
    if (conMatchPendiente) {
      setPaso('match');
      return;
    }
    onListo(`Gracias por valorar "${tallerNombre}".`);
  };

  const enviarMatch = async () => {
    try {
      await puntuar.mutateAsync(match as PuntuarMatchInput);
    } catch {
      return;
    }
    onListo(`Gracias por valorar "${tallerNombre}".`);
  };

  const error = (valorar.error ?? puntuar.error) as Error | null;

  return (
    <Dialog
      abierto
      titulo={paso === 'taller' ? 'Valorar el taller' : '¿Funcionó el match?'}
      descripcion={tallerNombre}
      onCerrar={onCerrar}
    >
      {error && <Alert className="mb-4">{error.message}</Alert>}

      {paso === 'taller' && (
        <div className="space-y-4">
          <ul className="space-y-3">
            {DIMENSIONES_VALORACION.map((dimension) => (
              <li key={dimension} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{ETIQUETAS_DIMENSION_VALORACION[dimension]}</span>
                <Estrellas
                  valor={estrellas[dimension]}
                  etiqueta={ETIQUETAS_DIMENSION_VALORACION[dimension]}
                  onCambiar={(valor) => setEstrellas({ ...estrellas, [dimension]: valor })}
                />
              </li>
            ))}
          </ul>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[#00347A]"
              checked={asistio}
              onChange={(evento) => setAsistio(evento.target.checked)}
            />
            Mi asistencia al taller
          </label>

          <div>
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <textarea
              id="referencia"
              className="min-h-20 w-full rounded-md border border-borde bg-white px-3 py-2 text-sm"
              maxLength={MAXIMO_REFERENCIA}
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              placeholder="Qué te llevaste del taller"
            />
            {/* Se dice antes de escribir, no después: es lo que la vuelve una firma. */}
            <p className="mt-1 text-xs text-texto-suave">
              Se publica dentro de tu empresa <strong>con tu nombre</strong>. RRHH puede ocultarla
              si corresponde.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>
              Ahora no
            </Button>
            <Button onClick={enviarValoracion} disabled={!completas || valorar.isPending}>
              {valorar.isPending ? 'Enviando…' : 'Enviar valoración'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'match' && (
        <div className="space-y-4">
          <p className="text-sm text-texto-suave">
            Una última cosa, sobre la persona con la que hiciste match.
          </p>

          <ul className="space-y-3">
            {PREGUNTAS_MATCH.map((pregunta) => (
              <li key={pregunta} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{ETIQUETAS_PREGUNTA_MATCH[pregunta]}</span>
                <SiNo
                  valor={match[pregunta]}
                  etiqueta={ETIQUETAS_PREGUNTA_MATCH[pregunta]}
                  onCambiar={(valor) => setMatch({ ...match, [pregunta]: valor })}
                />
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button onClick={enviarMatch} disabled={!matchCompleto || puntuar.isPending}>
              {puntuar.isPending ? 'Enviando…' : 'Listo'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function SiNo({
  valor,
  etiqueta,
  onCambiar,
}: {
  valor: boolean | undefined;
  etiqueta: string;
  onCambiar: (valor: boolean) => void;
}) {
  return (
    <span role="radiogroup" aria-label={etiqueta} className="inline-flex gap-1">
      {[true, false].map((opcion) => (
        <Button
          key={String(opcion)}
          type="button"
          role="radio"
          aria-checked={valor === opcion}
          size="sm"
          variant={valor === opcion ? 'default' : 'outline'}
          onClick={() => onCambiar(opcion)}
        >
          {opcion ? 'Sí' : 'No'}
        </Button>
      ))}
    </span>
  );
}

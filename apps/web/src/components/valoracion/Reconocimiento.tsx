import { VALORACIONES_PARA_CONTAR_EN_EL_SCORE, type ReferenciaPublicada } from '@enactiva/shared';
import { useState } from 'react';
import { useSesion } from '@/auth/sesion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useMostrarReferencia,
  useOcultarReferencia,
  useReconocimiento,
  useReferenciasDe,
} from '@/lib/valoracion';
import { Estrellas } from './Estrellas';

const FECHA = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' });

/**
 * El reconocimiento de quien enseña: tokens, estrellas y las referencias que le dejaron
 * (SPEC §3.5, ADR-0009).
 *
 * El recuento de tokens se ve dentro de la empresa **[E]**: la clienta dijo "visibles pero
 * privados" y el equipo lo leyó como visible para los colegas. Está preguntado.
 *
 * La plataforma lleva la cuenta y nada más: el canje lo administra cada empresa fuera de aquí
 * (Q18), así que aquí no hay saldo, premios ni transferencias.
 */
export function Reconocimiento({ usuarioId }: { usuarioId: string }) {
  const { data: reconocimiento } = useReconocimiento(usuarioId);
  const { data: referencias } = useReferenciasDe(usuarioId);

  if (!reconocimiento) return null;

  const faltan = VALORACIONES_PARA_CONTAR_EN_EL_SCORE - reconocimiento.cuantasValoraciones;

  return (
    <Card>
      <CardTitle>Tu reconocimiento</CardTitle>
      <CardDescription>
        Lo que recibes por enseñar. Los tokens los canjea tu empresa con sus propias reglas: acá
        solo llevamos la cuenta.
      </CardDescription>

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-texto-suave">Tokens</dt>
          <dd className="text-2xl font-extrabold">{reconocimiento.tokens} ⭐</dd>
        </div>
        <div>
          <dt className="text-xs text-texto-suave">Talleres dictados</dt>
          <dd className="text-2xl font-extrabold">{reconocimiento.talleresDictados}</dd>
        </div>
        <div>
          <dt className="text-xs text-texto-suave">Cómo te valoran</dt>
          <dd className="font-semibold">
            {reconocimiento.promedioEstrellas === null ? (
              <span className="text-sm text-texto-suave">Todavía nadie te valoró</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Estrellas valor={reconocimiento.promedioEstrellas} size="sm" />
                <span className="text-sm">{reconocimiento.promedioEstrellas}</span>
              </span>
            )}
          </dd>
        </div>
      </dl>

      {reconocimiento.promedioEstrellas !== null && !reconocimiento.cuentaEnElScore && (
        // Se dice en vez de esconderlo: si no, alguien con una mala valoración creería que ya
        // le está pesando en Descubrir cuando todavía no (ADR-0009).
        <p className="mt-3 text-xs text-texto-suave">
          {faltan === 1 ? 'Falta una valoración más' : `Faltan ${faltan} valoraciones`} para que tus
          estrellas influyan en el orden de Descubrir.
        </p>
      )}

      {referencias && referencias.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold">Lo que escribieron de ti</h3>
          <ul className="space-y-3">
            {referencias.map((referencia) => (
              <Referencia key={referencia.id} referencia={referencia} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Una referencia, firmada. Si quien mira es RRHH, además puede ocultarla o volver a mostrarla. */
function Referencia({ referencia }: { referencia: ReferenciaPublicada }) {
  const { puede } = useSesion();
  const ocultar = useOcultarReferencia();
  const mostrar = useMostrarReferencia();
  const [preguntando, setPreguntando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const modera = puede('referencias:moderar');

  return (
    <li className="rounded-lg border border-borde p-3">
      <p className="text-sm">{referencia.texto}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
        <span>
          {referencia.autorNombre} · {referencia.tallerNombre} ·{' '}
          {FECHA.format(new Date(referencia.createdAt))}
        </span>
        {referencia.oculta && <Badge variant="pendiente">Oculta</Badge>}
      </div>

      {referencia.oculta && referencia.motivoOcultada && (
        <p className="mt-2 text-xs text-texto-suave">Motivo: {referencia.motivoOcultada}</p>
      )}

      {modera && (
        <div className="mt-3">
          {referencia.oculta ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => mostrar.mutate(referencia.id)}
              disabled={mostrar.isPending}
            >
              Volver a mostrarla
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setPreguntando(true)}>
              Ocultar
            </Button>
          )}
        </div>
      )}

      <Dialog
        abierto={preguntando}
        titulo="Ocultar esta referencia"
        descripcion="No se borra: queda registro de que la ocultaste y por qué."
        onCerrar={() => {
          setPreguntando(false);
          setMotivo('');
        }}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor={`motivo-${referencia.id}`}>Por qué la ocultas</Label>
            <textarea
              id={`motivo-${referencia.id}`}
              className="min-h-20 w-full rounded-md border border-borde bg-white px-3 py-2 text-sm"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreguntando(false)}>
              Mejor no
            </Button>
            <Button
              disabled={motivo.trim().length < 10 || ocultar.isPending}
              onClick={() =>
                ocultar.mutate(
                  { id: referencia.id, motivo: motivo.trim() },
                  {
                    onSuccess: () => {
                      setPreguntando(false);
                      setMotivo('');
                    },
                  },
                )
              }
            >
              Ocultar
            </Button>
          </div>
        </div>
      </Dialog>
    </li>
  );
}

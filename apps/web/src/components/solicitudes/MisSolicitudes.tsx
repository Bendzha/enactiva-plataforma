import {
  ETIQUETAS_ESTADO_SOLICITUD,
  ETIQUETAS_TIPO_SOLICITUD,
  LARGO_MAXIMO_DETALLE,
  type EstadoSolicitud,
} from '@enactiva/shared';
import { useState } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useMisSolicitudes, usePedirRolEnsenar } from '@/lib/solicitudes';

const VARIANTE: Record<EstadoSolicitud, 'activa' | 'pendiente' | 'neutro'> = {
  PENDIENTE: 'pendiente',
  APROBADA: 'activa',
  RECHAZADA: 'neutro',
};

/**
 * Lo que le pedí a RRHH y en qué quedó (SPEC §2).
 *
 * Y el botón para pedir el rol de quien enseña, que solo aparece si todavía no lo tiene: una vez
 * aprobado, pedirlo otra vez no significa nada.
 */
export function MisSolicitudes() {
  const { usuario } = useSesion();
  const { data: solicitudes } = useMisSolicitudes();
  const pedir = usePedirRolEnsenar();

  const [pidiendo, setPidiendo] = useState(false);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const puedeEnsenar = usuario?.roles.includes('CAPACITADOR') ?? false;
  const yaPidioElRol = (solicitudes ?? []).some(
    (s) => s.tipo === 'CAMBIO_DE_ROL' && s.estado === 'PENDIENTE',
  );

  const enviar = async () => {
    setError(null);
    try {
      await pedir.mutateAsync({ detalle: detalle.trim() });
      setPidiendo(false);
      setDetalle('');
    } catch (problema) {
      setError(
        problema instanceof ErrorApi
          ? problema.message
          : 'No pudimos enviar tu solicitud. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <Card className="mt-6">
      <CardTitle>Lo que le pedí a RRHH</CardTitle>
      <CardDescription>
        El catálogo de temas y los roles los administra Recursos Humanos de tu organización.
      </CardDescription>

      {!puedeEnsenar && (
        <div className="mt-4">
          {yaPidioElRol ? (
            <p className="text-sm text-texto-suave">Pediste poder enseñar. RRHH lo va a revisar.</p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setPidiendo(true)}>
              Quiero poder enseñar
            </Button>
          )}
        </div>
      )}

      {(solicitudes ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-texto-suave">Todavía no pediste nada.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(solicitudes ?? []).map((solicitud) => (
            <li key={solicitud.id} className="rounded-md border border-borde p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {solicitud.tema ?? ETIQUETAS_TIPO_SOLICITUD[solicitud.tipo]}
                </span>
                <Badge variant={VARIANTE[solicitud.estado]} className="ml-auto">
                  {ETIQUETAS_ESTADO_SOLICITUD[solicitud.estado]}
                </Badge>
              </div>
              {solicitud.tema && (
                <p className="mt-1 text-xs text-texto-suave">
                  {ETIQUETAS_TIPO_SOLICITUD[solicitud.tipo]}
                </p>
              )}
              {solicitud.estado === 'RECHAZADA' && (
                <p className="mt-2 text-sm text-texto-suave">
                  {solicitud.motivoRechazo
                    ? `Motivo: ${solicitud.motivoRechazo}`
                    : 'RRHH no dejó un motivo.'}
                </p>
              )}
              {solicitud.estado === 'APROBADA' && solicitud.tipo === 'PROPUESTA_TALLER' && (
                <p className="mt-2 text-sm text-texto-suave">
                  El tema ya está en el catálogo y en tu perfil. RRHH va a crear el taller.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        abierto={pidiendo}
        titulo="Quiero poder enseñar"
        descripcion="RRHH decide si te agrega el rol. Si lo aprueba, podrás publicar talleres."
        onCerrar={() => setPidiendo(false)}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="detalle-rol">¿Qué te gustaría enseñar? (opcional)</Label>
            <textarea
              id="detalle-rol"
              rows={4}
              maxLength={LARGO_MAXIMO_DETALLE}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              className="mt-1 w-full rounded-md border border-borde px-3 py-2 text-sm focus:border-marca focus:outline-none"
            />
            <p className="mt-1 text-xs text-texto-suave">
              No escribas datos personales tuyos ni de nadie.
            </p>
          </div>

          {error && <Alert>{error}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPidiendo(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pedir.isPending} onClick={() => void enviar()}>
              {pedir.isPending ? 'Enviando…' : 'Enviar a RRHH'}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

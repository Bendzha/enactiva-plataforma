import {
  ETIQUETAS_ESTADO_SOLICITUD,
  ETIQUETAS_TIPO_SOLICITUD,
  LARGO_MAXIMO_MOTIVO_RECHAZO,
  type EstadoSolicitud,
  type SolicitudParaRrhh,
} from '@enactiva/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useAprobarSolicitud, useRechazarSolicitud, useSolicitudes } from '@/lib/solicitudes';

const VARIANTE: Record<EstadoSolicitud, 'activa' | 'pendiente' | 'neutro'> = {
  PENDIENTE: 'pendiente',
  APROBADA: 'activa',
  RECHAZADA: 'neutro',
};

function nombreDe(solicitud: SolicitudParaRrhh): string {
  const { nombre, apellido, email } = solicitud.solicitante;
  return [nombre, apellido].filter(Boolean).join(' ') || email || 'Sin nombre';
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Bandeja de solicitudes de RRHH (SPEC §2, reunión del 2026-10-29).
 *
 * Aprobar una propuesta de taller **solo cambia el estado**: el tema y el taller los crea RRHH a
 * mano, como pidió la clienta. La pantalla lo dice, porque si no, aprobar parecería suficiente.
 */
export function SolicitudesPage() {
  const { data: solicitudes, isPending } = useSolicitudes();
  const aprobar = useAprobarSolicitud();
  const rechazar = useRechazarSolicitud();

  const [rechazando, setRechazando] = useState<SolicitudParaRrhh | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const pendientes = (solicitudes ?? []).filter((s) => s.estado === 'PENDIENTE');
  const resueltas = (solicitudes ?? []).filter((s) => s.estado !== 'PENDIENTE');

  const problema = (error: unknown, porDefecto: string) =>
    setError(error instanceof ErrorApi ? error.message : porDefecto);

  const alAprobar = async (solicitud: SolicitudParaRrhh) => {
    setError(null);
    setAviso(null);
    try {
      await aprobar.mutateAsync(solicitud.id);
      setAviso(
        solicitud.tipo === 'CAMBIO_DE_ROL'
          ? `${nombreDe(solicitud)} ya puede publicar talleres.`
          : `Aprobaste la propuesta de «${solicitud.tema}». Ahora crea el tema y el taller.`,
      );
    } catch (fallo) {
      problema(fallo, 'No pudimos aprobar la solicitud.');
    }
  };

  const alRechazar = async () => {
    if (!rechazando) return;
    setError(null);
    setAviso(null);
    try {
      await rechazar.mutateAsync({ id: rechazando.id, motivo: motivo.trim() || undefined });
      setAviso(`Rechazaste la solicitud de ${nombreDe(rechazando)}.`);
      setRechazando(null);
      setMotivo('');
    } catch (fallo) {
      problema(fallo, 'No pudimos rechazar la solicitud.');
    }
  };

  const tarjeta = (solicitud: SolicitudParaRrhh) => (
    <Card key={solicitud.id} className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <div className="font-semibold">{nombreDe(solicitud)}</div>
          <div className="text-xs text-texto-suave">
            {ETIQUETAS_TIPO_SOLICITUD[solicitud.tipo]} · {fecha(solicitud.createdAt)}
          </div>
        </div>
        <Badge variant={VARIANTE[solicitud.estado]} className="ml-auto">
          {ETIQUETAS_ESTADO_SOLICITUD[solicitud.estado]}
        </Badge>
      </div>

      {solicitud.tema && (
        <p className="text-sm">
          Tema propuesto: <strong>{solicitud.tema}</strong>
        </p>
      )}
      {solicitud.detalle && (
        <p className="whitespace-pre-line rounded-md bg-fondo p-3 text-sm text-texto-suave">
          {solicitud.detalle}
        </p>
      )}
      {solicitud.motivoRechazo && (
        <p className="text-sm text-texto-suave">
          Motivo del rechazo: <em>{solicitud.motivoRechazo}</em>
        </p>
      )}
      {solicitud.estado !== 'PENDIENTE' && solicitud.resueltaPor && (
        <p className="text-xs text-texto-suave">Resuelta por {solicitud.resueltaPor}</p>
      )}

      {solicitud.estado === 'PENDIENTE' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={aprobar.isPending} onClick={() => void alAprobar(solicitud)}>
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRechazando(solicitud);
              setMotivo('');
            }}
          >
            Rechazar
          </Button>
          {solicitud.tipo === 'PROPUESTA_TALLER' && (
            <span className="self-center text-xs text-texto-suave">
              Al aprobar, el tema y el taller los creas tú.
            </span>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solicitudes</h1>
        <p className="text-sm text-texto-suave">
          Lo que tu gente te pide: proponer un taller sobre un tema que no está en el catálogo, o
          pasar a poder enseñar.
        </p>
      </div>

      {aviso && (
        <p role="status" className="rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}
      {error && <Alert>{error}</Alert>}

      {isPending ? (
        <p className="text-sm text-texto-suave">Cargando…</p>
      ) : (solicitudes ?? []).length === 0 ? (
        <Card>
          <CardTitle>Todavía no hay solicitudes</CardTitle>
          <CardDescription>
            Cuando alguien proponga un taller o pida enseñar, aparece acá. El catálogo de temas lo
            administras tú desde <Link to="/personas">Personas</Link>.
          </CardDescription>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
              Pendientes ({pendientes.length})
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-sm text-texto-suave">Ninguna pendiente.</p>
            ) : (
              pendientes.map(tarjeta)
            )}
          </section>

          {resueltas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
                Resueltas
              </h2>
              {resueltas.map(tarjeta)}
            </section>
          )}
        </>
      )}

      <Dialog
        abierto={rechazando !== null}
        titulo="Rechazar la solicitud"
        descripcion="El motivo es opcional. Si lo escribes, lo va a ver quien la pidió."
        onCerrar={() => setRechazando(null)}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={LARGO_MAXIMO_MOTIVO_RECHAZO}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 w-full rounded-md border border-borde px-3 py-2 text-sm focus:border-marca focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={rechazar.isPending} onClick={() => void alRechazar()}>
              {rechazar.isPending ? 'Rechazando…' : 'Rechazar'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

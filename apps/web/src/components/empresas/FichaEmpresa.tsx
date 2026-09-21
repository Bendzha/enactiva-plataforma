import { useState } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorApi } from '@/lib/api';
import { useActivarEmpresa, useEmpresa, useReenviarInvitacion } from '@/lib/empresas';

interface Props {
  empresaId: string | null;
  onCerrar: () => void;
}

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

export function FichaEmpresa({ empresaId, onCerrar }: Props) {
  const { puede } = useSesion();
  const { data: empresa, isPending } = useEmpresa(empresaId);
  const activar = useActivarEmpresa();
  const reenviar = useReenviarInvitacion();
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAviso(null);
    setError(null);
    onCerrar();
  };

  const ejecutar = async (accion: () => Promise<unknown>, mensajeOk: string) => {
    setAviso(null);
    setError(null);
    try {
      await accion();
      setAviso(mensajeOk);
    } catch (e) {
      setError(
        e instanceof ErrorApi && e.status === 409
          ? e.message
          : 'No pudimos completar la acción. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <Dialog
      abierto={empresaId !== null}
      titulo={empresa?.nombre ?? 'Ficha de empresa'}
      descripcion={empresa?.rubro}
      onCerrar={cerrar}
      variante="lateral"
    >
      {isPending || !empresa ? (
        <p className="text-sm text-texto-suave">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge variant={empresa.estado === 'ACTIVA' ? 'activa' : 'pendiente'}>
              {empresa.estado === 'ACTIVA' ? 'Activa' : 'Onboarding pendiente'}
            </Badge>
            {empresa.activadaAt && (
              <span className="text-xs text-texto-suave">
                Activada el {fecha(empresa.activadaAt)}
              </span>
            )}
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
              Resumen
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-borde p-3">
                <div className="text-xl font-extrabold">{empresa.personasActivas}</div>
                <div className="text-xs text-texto-suave">Personas activas</div>
              </div>
              <div className="rounded-lg border border-borde p-3">
                <div className="text-sm font-semibold text-texto-suave">Aún sin mediciones</div>
                <div className="text-xs text-texto-suave">Logro promedio</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
              Contacto de RRHH
            </h3>
            {empresa.contactoRrhh ? (
              <div className="rounded-lg border border-borde p-3 text-sm">
                {/* Mientras no acepta la invitación no tenemos su nombre: se muestra solo el email. */}
                {empresa.contactoRrhh.nombre ? (
                  <>
                    <div className="font-semibold">
                      {`${empresa.contactoRrhh.nombre} ${empresa.contactoRrhh.apellido ?? ''}`.trim()}
                    </div>
                    <div className="text-xs text-texto-suave">{empresa.contactoRrhh.email}</div>
                  </>
                ) : (
                  <div className="font-semibold">{empresa.contactoRrhh.email}</div>
                )}
                <div className="mt-2 text-xs">
                  {empresa.contactoRrhh.estado === 'INVITADO' ? (
                    <>
                      Invitación enviada
                      {empresa.contactoRrhh.invitacionExpiraAt && (
                        <> · vence el {fecha(empresa.contactoRrhh.invitacionExpiraAt)}</>
                      )}
                    </>
                  ) : (
                    'Cuenta activada'
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-texto-suave">Esta empresa no tiene contacto de RRHH.</p>
            )}
          </section>

          {aviso && (
            <p role="status" className="rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
              {aviso}
            </p>
          )}
          {error && <Alert>{error}</Alert>}

          <div className="flex flex-wrap gap-2">
            {puede('empresas:activar') && empresa.estado !== 'ACTIVA' && (
              <Button
                disabled={activar.isPending}
                onClick={() =>
                  ejecutar(() => activar.mutateAsync(empresa.id), 'Empresa activada en el piloto.')
                }
              >
                {activar.isPending ? 'Activando…' : 'Activar empresa'}
              </Button>
            )}

            {puede('invitaciones:gestionar') && empresa.contactoRrhh?.estado === 'INVITADO' && (
              <Button
                variant="outline"
                disabled={reenviar.isPending}
                onClick={() =>
                  ejecutar(
                    () => reenviar.mutateAsync(empresa.id),
                    'Invitación reenviada al correo del contacto.',
                  )
                }
              >
                {reenviar.isPending ? 'Reenviando…' : 'Reenviar invitación'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

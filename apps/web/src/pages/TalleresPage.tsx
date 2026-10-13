import type { TallerResumen } from '@enactiva/shared';
import { useState } from 'react';
import { useSesion } from '@/auth/sesion';
import { FormularioTaller } from '@/components/talleres/FormularioTaller';
import { MiDisponibilidad } from '@/components/talleres/MiDisponibilidad';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ErrorApi } from '@/lib/api';
import {
  useCancelarInscripcion,
  useInscribirse,
  useMisTalleres,
  useTalleres,
} from '@/lib/talleres';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const FORMATO_HORA = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

function cuando(taller: TallerResumen): string {
  const inicio = new Date(taller.inicioAt);
  return `${FORMATO_FECHA.format(inicio)} · ${FORMATO_HORA.format(inicio)} a ${FORMATO_HORA.format(new Date(taller.finAt))}`;
}

export function TalleresPage() {
  const { usuario, puede } = useSesion();
  const deUnaEmpresa = Boolean(usuario?.empresaId);
  const puedePublicar = puede('talleres:publicar');

  const { data: proximos, isPending, isError } = useTalleres(deUnaEmpresa);
  const { data: mios } = useMisTalleres(puedePublicar);
  const inscribirse = useInscribirse();
  const cancelar = useCancelarInscripcion();

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState<TallerResumen | undefined>();
  const [disponibilidadAbierta, setDisponibilidadAbierta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!deUnaEmpresa) {
    return (
      <section>
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Talleres</h1>
        </header>
        <Card>
          <CardTitle>Tu cuenta es del equipo ENACTIVA</CardTitle>
          <CardDescription>
            Los talleres los convocan las personas de cada empresa del piloto.
          </CardDescription>
        </Card>
      </section>
    );
  }

  const alInscribirse = async (taller: TallerResumen) => {
    setAviso(null);
    try {
      await inscribirse.mutateAsync(taller.id);
      setAviso(`Quedaste inscrito en "${taller.nombre}".`);
    } catch (problema) {
      setAviso(
        problema instanceof ErrorApi
          ? problema.message
          : 'No pudimos inscribirte. Inténtalo luego.',
      );
    }
  };

  const alCancelar = async (taller: TallerResumen) => {
    setAviso(null);
    try {
      await cancelar.mutateAsync(taller.id);
      setAviso(`Cancelaste tu inscripción en "${taller.nombre}".`);
    } catch (problema) {
      setAviso(
        problema instanceof ErrorApi
          ? problema.message
          : 'No pudimos cancelar tu inscripción. Inténtalo luego.',
      );
    }
  };

  const abrirNuevo = () => {
    setEditando(undefined);
    setFormularioAbierto(true);
  };

  const abrirEdicion = (taller: TallerResumen) => {
    setEditando(taller);
    setFormularioAbierto(true);
  };

  const tarjeta = (taller: TallerResumen, conAcciones: boolean) => (
    <li key={taller.id} className="rounded-xl border border-borde bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{taller.nombre}</h3>
          <p className="text-xs text-texto-suave">
            {taller.temaNombre} · {cuando(taller)} · {taller.ubicacion}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {taller.empezado && <Badge variant="neutro">Ya ocurrió</Badge>}
          {!taller.empezado && taller.cuposDisponibles === 0 && (
            <Badge variant="pendiente">Sin cupos</Badge>
          )}
          {taller.inscrito && <Badge variant="activa">Estás inscrito</Badge>}
        </div>
      </div>

      <p className="mt-2 text-sm">{taller.objetivo}</p>
      <p className="mt-1 text-xs text-texto-suave">
        Te llevas: {taller.resultadosEsperados} · {taller.inscritos} de {taller.cupo} inscritos
      </p>

      {conAcciones && !taller.empezado && (
        <div className="mt-3 flex flex-wrap gap-2">
          {taller.esMio ? (
            <Button variant="outline" size="sm" onClick={() => abrirEdicion(taller)}>
              Editar ficha
            </Button>
          ) : taller.inscrito ? (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelar.isPending}
              onClick={() => alCancelar(taller)}
            >
              Cancelar inscripción
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={inscribirse.isPending || taller.cuposDisponibles === 0}
              onClick={() => alInscribirse(taller)}
            >
              Inscribirme
            </Button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Talleres</h1>
          <p className="text-sm text-texto-suave">
            La actividad ocurre en persona: acá se convoca y se reserva el cupo.
          </p>
        </div>
        {puedePublicar && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDisponibilidadAbierta(true)}>
              Mi disponibilidad
            </Button>
            <Button onClick={abrirNuevo}>+ Publicar taller</Button>
          </div>
        )}
      </header>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      {puedePublicar && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Los que dicto yo</h2>
          {mios?.length === 0 ? (
            <Card>
              <CardTitle>Todavía no has convocado ninguno</CardTitle>
              <CardDescription>
                Publica una ficha con la fecha, el lugar y el cupo, y tu gente podrá inscribirse.
              </CardDescription>
            </Card>
          ) : (
            <ul className="space-y-3">{(mios ?? []).map((taller) => tarjeta(taller, true))}</ul>
          )}
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold">Próximos en mi organización</h2>
      {isPending && <p className="text-sm text-texto-suave">Cargando talleres…</p>}
      {isError && <Alert>No pudimos cargar los talleres. Actualiza la página.</Alert>}

      {proximos?.length === 0 && (
        <Card>
          <CardTitle>No hay talleres convocados</CardTitle>
          <CardDescription>
            Cuando alguien publique uno, va a aparecer acá con su fecha y su lugar.
          </CardDescription>
        </Card>
      )}

      {proximos && proximos.length > 0 && (
        <ul className="space-y-3">{proximos.map((taller) => tarjeta(taller, true))}</ul>
      )}

      {formularioAbierto && (
        <FormularioTaller
          abierto
          taller={editando}
          onCerrar={() => setFormularioAbierto(false)}
          onGuardado={(nombre) => setAviso(`Guardamos "${nombre}".`)}
        />
      )}

      <MiDisponibilidad
        abierto={disponibilidadAbierta}
        onCerrar={() => setDisponibilidadAbierta(false)}
        onGuardado={() => setAviso('Guardamos tu disponibilidad.')}
      />
    </section>
  );
}

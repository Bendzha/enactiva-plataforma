import type { ItemAgenda } from '@enactiva/shared';
import { Link } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { botonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useAgenda } from '@/lib/agenda';

const FECHA = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const HORA = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

function cuando(item: ItemAgenda): string {
  const inicio = new Date(item.inicioAt);
  return `${FECHA.format(inicio)} · ${HORA.format(inicio)} a ${HORA.format(new Date(item.finAt))}`;
}

/** Cuánto falta, en palabras. "En 3 días" se entiende más rápido que una fecha. */
function cuantoFalta(item: ItemAgenda): string | null {
  const horas = (new Date(item.inicioAt).getTime() - Date.now()) / 3_600_000;
  if (horas < 0) return 'Está ocurriendo';
  if (horas < 1) return 'En menos de una hora';
  if (horas < 24) return `En ${Math.round(horas)} horas`;
  if (horas < 48) return 'Mañana';
  return null;
}

function Fila({ item }: { item: ItemAgenda }) {
  const falta = cuantoFalta(item);

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-xl border border-borde bg-white p-4">
      <div className="min-w-48 grow">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{item.nombre}</span>
          <Badge variant={item.papel === 'DICTO' ? 'activa' : 'neutro'}>
            {item.papel === 'DICTO' ? 'Lo dictas tú' : 'Vas a asistir'}
          </Badge>
          {falta && <Badge variant="pendiente">{falta}</Badge>}
        </div>
        <p className="mt-1 text-xs text-texto-suave">
          {item.temaNombre} · {cuando(item)} · {item.ubicacion}
        </p>
      </div>
      <span className="text-xs text-texto-suave">
        {item.inscritos} de {item.cupo} inscritos
      </span>
    </li>
  );
}

/**
 * La agenda de cada persona, con lo que dicta y a lo que va en la misma lista.
 *
 * Quien enseña también aprende: tener dos pantallas para "el martes a las 10 tengo algo" sería
 * pedirle a la gente que lleve la cuenta en su cabeza.
 */
export function AgendaPage() {
  const { usuario } = useSesion();
  const deUnaEmpresa = Boolean(usuario?.empresaId);
  const { data: agenda, isPending, isError } = useAgenda(deUnaEmpresa);

  if (!deUnaEmpresa) {
    return (
      <section>
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Mi agenda</h1>
        </header>
        <Card>
          <CardTitle>Tu cuenta es del equipo ENACTIVA</CardTitle>
          <CardDescription>
            La agenda es de cada colaborador: los talleres que dicta y a los que va.
          </CardDescription>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Mi agenda</h1>
        <p className="text-sm text-texto-suave">
          Lo que dictas y a lo que vas. Te llegará un recordatorio por correo el día antes y una
          hora antes de cada uno.
        </p>
      </header>

      {isPending && <p className="text-sm text-texto-suave">Cargando tu agenda…</p>}
      {isError && <Alert>No pudimos cargar tu agenda. Actualiza la página.</Alert>}

      {agenda && agenda.proximos.length === 0 && (
        <Card className="mb-6">
          <CardTitle>No tienes nada agendado</CardTitle>
          <CardDescription>
            Cuando te inscribas en un taller o publiques uno, va a aparecer acá.
          </CardDescription>
          <div className="mt-4">
            <Link to="/descubrir" className={botonVariants()}>
              Descubrir talleres
            </Link>
          </div>
        </Card>
      )}

      {agenda && agenda.proximos.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold">Lo que viene</h2>
          <ul className="mb-8 space-y-3">
            {agenda.proximos.map((item) => (
              <Fila key={item.tallerId} item={item} />
            ))}
          </ul>
        </>
      )}

      {agenda && agenda.pasados.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold">Ya ocurrieron</h2>
          <ul className="space-y-3 opacity-75">
            {agenda.pasados.map((item) => (
              <Fila key={item.tallerId} item={item} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

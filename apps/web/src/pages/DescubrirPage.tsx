import type { DecisionMazo, TarjetaMazo } from '@enactiva/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, botonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useDecidir, useMazo } from '@/lib/mazo';

const FECHA = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const HORA = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

function cuando(tarjeta: TarjetaMazo): string {
  const inicio = new Date(tarjeta.inicioAt);
  return `${FECHA.format(inicio)} · ${HORA.format(inicio)} a ${HORA.format(new Date(tarjeta.finAt))}`;
}

/**
 * El swipe: una tarjeta a la vez, con el taller que más le calza a esta persona arriba de todo.
 *
 * Se muestra de a una a propósito. Una lista invita a comparar; una tarjeta invita a decidir, y
 * decidir es lo que hace que el match exista.
 */
export function DescubrirPage() {
  const { usuario } = useSesion();
  const deUnaEmpresa = Boolean(usuario?.empresaId);

  const [buscar, setBuscar] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: tarjetas, isPending, isError } = useMazo(buscar, deUnaEmpresa);
  const decidir = useDecidir();

  if (!deUnaEmpresa) {
    return (
      <section>
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Descubrir</h1>
        </header>
        <Card>
          <CardTitle>Tu cuenta es del equipo ENACTIVA</CardTitle>
          <CardDescription>
            El mazo empareja a las personas dentro de cada empresa del piloto.
          </CardDescription>
        </Card>
      </section>
    );
  }

  const tarjeta = tarjetas?.[0];

  const responder = async (decision: DecisionMazo) => {
    if (!tarjeta) return;
    setAviso(null);
    try {
      const resultado = await decidir.mutateAsync({ tallerId: tarjeta.tallerId, decision });
      setAviso(resultado.mensaje);
    } catch (problema) {
      setAviso(
        problema instanceof ErrorApi
          ? problema.message
          : 'No pudimos guardar tu decisión. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Descubrir</h1>
        <p className="text-sm text-texto-suave">
          Talleres de tu organización, ordenados por lo que calza con tu perfil.
        </p>
      </header>

      <div className="mb-6 max-w-sm">
        <Label htmlFor="buscar-tema-mazo">Filtrar por tema (opcional)</Label>
        <Input
          id="buscar-tema-mazo"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Ej: Excel"
          autoComplete="off"
        />
      </div>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      {isPending && <p className="text-sm text-texto-suave">Buscando talleres para ti…</p>}
      {isError && <Alert>No pudimos cargar el mazo. Actualiza la página.</Alert>}

      {tarjetas && tarjetas.length === 0 && (
        <Card>
          <CardTitle>No queda nada por decidir</CardTitle>
          <CardDescription>
            {buscar.trim()
              ? 'Ningún taller coincide con ese tema. Prueba con otra palabra o limpia el filtro.'
              : 'Ya pasaste por todos los talleres convocados. Cuando alguien publique uno nuevo, aparecerá acá.'}
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/mi-perfil" className={botonVariants({ variant: 'outline' })}>
              Revisar mi perfil
            </Link>
            <Link to="/talleres" className={botonVariants({ variant: 'outline' })}>
              Ver todos los talleres
            </Link>
          </div>
        </Card>
      )}

      {tarjeta && (
        <>
          <article
            className="rounded-xl border border-borde bg-white p-6 shadow-sm"
            aria-label={`Taller ${tarjeta.nombre}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="activa">{tarjeta.temaNombre}</Badge>
                <h2 className="mt-2 text-xl font-extrabold tracking-tight">{tarjeta.nombre}</h2>
                <p className="text-sm text-texto-suave">{cuando(tarjeta)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-marca">{tarjeta.score}</p>
                <p className="text-xs text-texto-suave">de afinidad</p>
              </div>
            </div>

            <p className="mt-4">{tarjeta.objetivo}</p>
            <p className="mt-1 text-sm text-texto-suave">
              Te llevas: {tarjeta.resultadosEsperados}
            </p>

            <dl className="mt-4 grid gap-3 border-t border-borde pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-texto-suave">Lo dicta</dt>
                <dd className="font-semibold">{tarjeta.facilitador.nombre}</dd>
                <dd className="text-xs text-texto-suave">
                  {[tarjeta.facilitador.cargo, tarjeta.facilitador.area]
                    .filter(Boolean)
                    .join(' · ')}
                  {tarjeta.facilitador.mismaArea && ' · tu área'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Dónde</dt>
                <dd className="font-semibold">{tarjeta.ubicacion}</dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Cupos</dt>
                <dd className="font-semibold">
                  quedan {tarjeta.cuposDisponibles} de {tarjeta.cupo}
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-md bg-fondo px-3 py-2 text-xs text-texto-suave">
              Te aparece primero porque {tarjeta.porQue}.
            </p>
          </article>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={decidir.isPending}
              onClick={() => responder('DESCARTADO')}
            >
              ✕ No me interesa
            </Button>
            <Button size="lg" disabled={decidir.isPending} onClick={() => responder('INTERESADO')}>
              ♥ Me interesa e inscribirme
            </Button>
            <span className="text-xs text-texto-suave">
              {tarjetas.length === 1 ? 'Última tarjeta' : `Quedan ${tarjetas.length} por revisar`}
            </span>
          </div>

          <p className="mt-3 text-xs text-texto-suave">
            Dar &quot;me interesa&quot; te inscribe de inmediato: no hay que esperar aprobación.
          </p>
        </>
      )}
    </section>
  );
}

import {
  ETIQUETAS_DIMENSION,
  ETIQUETAS_NIVEL_DOMINIO,
  ETIQUETAS_TIPO_INTERES,
  MAXIMO_INTERESES_GENERALES,
  type InteresDeclarado,
  type TipoInteres,
} from '@enactiva/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useSesion } from '@/auth/sesion';
import { AgregarInteres } from '@/components/perfil/AgregarInteres';
import { MisDatos } from '@/components/perfil/MisDatos';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useEliminarInteres, useGuardarPerfil, useMiPerfil } from '@/lib/perfil';

export function MiPerfilPage() {
  const { usuario } = useSesion();
  // El equipo de ENACTIVA no pertenece a ninguna empresa, así que no tiene perfil corporativo.
  const deUnaEmpresa = Boolean(usuario?.empresaId);

  const { data: perfil, isPending, isError } = useMiPerfil(deUnaEmpresa);
  const guardar = useGuardarPerfil();
  const eliminar = useEliminarInteres();

  const [intereses, setIntereses] = useState('');
  const [tipoAbierto, setTipoAbierto] = useState<TipoInteres | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (perfil) setIntereses(perfil.interesesGenerales);
  }, [perfil]);

  if (!deUnaEmpresa) {
    return (
      <section>
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Mi perfil</h1>
        </header>
        <div className="space-y-6">
          <Card>
            <CardTitle>Tu cuenta es del equipo ENACTIVA</CardTitle>
            <CardDescription>
              El perfil corporativo lo completa cada colaborador dentro de su empresa: qué puede
              enseñar y qué quiere aprender.
            </CardDescription>
          </Card>
          {/* Llevarse sus datos es derecho de cualquiera, también de quien opera la plataforma. */}
          <MisDatos puedeEliminar={false} />
        </div>
      </section>
    );
  }

  const guardarIntereses = async (evento: FormEvent) => {
    evento.preventDefault();
    await guardar.mutateAsync({ interesesGenerales: intereses.trim() });
    setAviso('Guardamos tus intereses.');
  };

  const quitar = async (interes: InteresDeclarado) => {
    await eliminar.mutateAsync(interes.id);
    setAviso(`Quitamos "${interes.temaNombre}" de tu perfil.`);
  };

  const seccion = (tipo: TipoInteres, declarados: InteresDeclarado[], vacio: string) => (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{ETIQUETAS_TIPO_INTERES[tipo]}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setTipoAbierto(tipo)}>
          + Agregar tema
        </Button>
      </div>

      {declarados.length === 0 && <CardDescription>{vacio}</CardDescription>}

      {declarados.length > 0 && (
        <ul className="space-y-2">
          {declarados.map((interes) => (
            <li
              key={interes.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-borde p-3"
            >
              <span className="min-w-32 grow font-semibold">{interes.temaNombre}</span>
              {interes.dimensiones.map((dimension) => (
                <Badge key={dimension} variant="neutro">
                  {ETIQUETAS_DIMENSION[dimension]}
                </Badge>
              ))}
              <span className="text-xs text-texto-suave">
                Nivel {ETIQUETAS_NIVEL_DOMINIO[interes.nivel].toLowerCase()}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={eliminar.isPending}
                onClick={() => quitar(interes)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-texto-suave">
          Lo que declares aquí es con lo que la plataforma te va a emparejar con otras personas de
          tu organización.
        </p>
      </header>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      {isPending && <p className="text-sm text-texto-suave">Cargando tu perfil…</p>}
      {isError && <Alert>No pudimos cargar tu perfil. Actualiza la página.</Alert>}

      {perfil && (
        <div className="space-y-6">
          <Card>
            <CardTitle>Tus datos en la organización</CardTitle>
            <CardDescription>
              El cargo y el área los administra RRHH. Si algo no corresponde, avísales.
            </CardDescription>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-texto-suave">Nombre</dt>
                <dd className="font-semibold">
                  {[perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Cargo</dt>
                <dd className="font-semibold">{perfil.cargo ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-texto-suave">Área</dt>
                <dd className="font-semibold">{perfil.areaNombre ?? 'Sin área'}</dd>
              </div>
            </dl>

            <form className="mt-6" onSubmit={guardarIntereses}>
              <Label htmlFor="intereses-generales">Intereses generales</Label>
              <textarea
                id="intereses-generales"
                className="min-h-24 w-full rounded-md border border-borde bg-white px-3 py-2 text-sm"
                value={intereses}
                maxLength={MAXIMO_INTERESES_GENERALES}
                onChange={(e) => setIntereses(e.target.value)}
                placeholder="Ej: innovación, bienestar laboral, mejora de procesos"
              />
              <p className="mt-1 text-xs text-texto-suave">
                Son temas de trabajo, no datos personales: no escribas información de tu vida
                privada ni de otras personas.
              </p>
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={guardar.isPending}>
                  {guardar.isPending ? 'Guardando…' : 'Guardar intereses'}
                </Button>
              </div>
            </form>
          </Card>

          {seccion(
            'ENSENAR',
            perfil.puedoEnsenar,
            'Todavía no declaraste nada que puedas enseñar. Agrega al menos un tema para que te encuentren.',
          )}
          {seccion(
            'APRENDER',
            perfil.quieroAprender,
            'Todavía no declaraste nada que quieras aprender.',
          )}
          <MisDatos puedeEliminar />
        </div>
      )}

      {tipoAbierto && (
        <AgregarInteres
          abierto
          tipo={tipoAbierto}
          onCerrar={() => setTipoAbierto(null)}
          onDeclarado={(tema) => setAviso(`Agregamos "${tema}" a tu perfil.`)}
        />
      )}
    </section>
  );
}

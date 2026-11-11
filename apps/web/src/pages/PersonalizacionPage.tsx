import {
  avisosDeContraste,
  COLORES_PERSONALIZABLES,
  derivadosDeMarca,
  DESCRIPCIONES_COLOR,
  ETIQUETAS_COLOR,
  guardarPersonalizacionSchema,
  LARGO_MAXIMO_LOGO,
  PALETA_POR_OMISION,
  TIPOS_LOGO,
  type ColorPersonalizable,
} from '@enactiva/shared';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useGuardarPersonalizacion,
  usePersonalizacion,
  useRestablecerPersonalizacion,
} from '@/lib/personalizacion';

type Paleta = Record<ColorPersonalizable, string>;

/** Lee el archivo como data URI, que es como viaja y como se guarda. */
function leerComoDataUri(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

/**
 * El entorno visual de la empresa (SPEC §3.8, ADR-0011).
 *
 * **El contraste no se fuerza**: la clienta dijo que lo ven ellos. La pantalla avisa y muestra una
 * vista previa, pero guarda igual. Lo único que se valida es que el color sea hexadecimal, porque
 * de ahí sale una variable CSS.
 */
export function PersonalizacionPage() {
  const { usuario } = useSesion();
  const { data: actual, isPending } = usePersonalizacion(usuario?.empresaId);
  const guardar = useGuardarPersonalizacion();
  const restablecer = useRestablecerPersonalizacion();

  const [paleta, setPaleta] = useState<Paleta>(PALETA_POR_OMISION);
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Al llegar los datos, el formulario parte de lo que la empresa tiene; si no personalizó, de la
  // plantilla, que es exactamente lo que está viendo.
  useEffect(() => {
    if (!actual) return;
    setPaleta(actual.colores ?? PALETA_POR_OMISION);
    setLogo(actual.logo);
  }, [actual]);

  const avisos = avisosDeContraste(paleta);
  const derivados = derivadosDeMarca(paleta.marca);

  const cambiarColor = (color: ColorPersonalizable, valor: string) =>
    setPaleta((actuales) => ({ ...actuales, [color]: valor.toUpperCase() }));

  const elegirLogo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;

    setError(null);
    setAviso(null);

    if (!TIPOS_LOGO.includes(archivo.type as (typeof TIPOS_LOGO)[number])) {
      setError('El logo tiene que ser PNG, JPEG o WebP.');
      return;
    }

    const dataUri = await leerComoDataUri(archivo);
    if (dataUri.length > LARGO_MAXIMO_LOGO) {
      setError('El logo pesa demasiado. Usa una imagen más liviana (cerca de 80 KB).');
      return;
    }
    setLogo(dataUri);
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setAviso(null);

    const validacion = guardarPersonalizacionSchema.safeParse({ colores: paleta, logo });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    try {
      await guardar.mutateAsync(validacion.data);
      setAviso('Listo. Tu gente va a ver estos colores al entrar.');
    } catch {
      setError('No pudimos guardar los cambios. Inténtalo de nuevo.');
    }
  };

  const volverALaPlantilla = async () => {
    setError(null);
    setAviso(null);
    try {
      await restablecer.mutateAsync();
      setPaleta(PALETA_POR_OMISION);
      setLogo(null);
      setAviso('Tu entorno volvió a la plantilla de ENACTIVA.');
    } catch {
      setError('No pudimos volver a la plantilla. Inténtalo de nuevo.');
    }
  };

  if (isPending) {
    return <p className="text-sm text-texto-suave">Cargando…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">El entorno de {actual?.empresaNombre}</h1>
        <p className="text-sm text-texto-suave">
          Tu logo y tus colores, para la gente de tu organización. No cambia la pantalla de inicio
          de sesión, ni lo que ve ENACTIVA, ni a las demás empresas.
        </p>
      </div>

      <form className="grid gap-6 lg:grid-cols-[1fr_20rem]" onSubmit={enviar}>
        <div className="space-y-6">
          <Card>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Reemplaza «ENACTIVA Match» arriba a la izquierda. PNG, JPEG o WebP, hasta unos 80 KB.
            </CardDescription>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="grid h-16 w-40 place-items-center rounded-md border border-borde bg-white p-2">
                {logo ? (
                  <img src={logo} alt="Tu logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-texto-suave">Sin logo</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-md border border-borde px-3 py-1.5 text-sm font-semibold hover:bg-fondo">
                  Elegir imagen
                  <input
                    type="file"
                    accept={TIPOS_LOGO.join(',')}
                    className="sr-only"
                    onChange={(e) => void elegirLogo(e)}
                  />
                </label>
                {logo && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setLogo(null)}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Colores</CardTitle>
            <CardDescription>
              Cuatro colores. Los tonos derivados del principal se calculan solos.
            </CardDescription>

            <div className="mt-4 space-y-4">
              {COLORES_PERSONALIZABLES.map((color) => (
                <div key={color} className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    id={`color-${color}`}
                    aria-label={ETIQUETAS_COLOR[color]}
                    value={paleta[color]}
                    onChange={(e) => cambiarColor(color, e.target.value)}
                    className="size-10 cursor-pointer rounded border border-borde bg-white"
                  />
                  <div className="min-w-48 flex-1">
                    <Label htmlFor={`hex-${color}`}>{ETIQUETAS_COLOR[color]}</Label>
                    <p className="text-xs text-texto-suave">{DESCRIPCIONES_COLOR[color]}</p>
                  </div>
                  <Input
                    id={`hex-${color}`}
                    aria-label={`${ETIQUETAS_COLOR[color]} en hexadecimal`}
                    value={paleta[color]}
                    onChange={(e) => cambiarColor(color, e.target.value)}
                    className="w-32 font-mono"
                  />
                </div>
              ))}
            </div>
          </Card>

          {avisos.length > 0 && (
            <Alert>
              <strong>Ojo con el contraste.</strong> Puedes guardarlo igual, pero esto puede quedar
              difícil de leer:
              <ul className="mt-1 list-inside list-disc">
                {avisos.map((aviso) => (
                  <li key={aviso.par}>
                    {aviso.par} ({aviso.razon.toFixed(1)}:1)
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {error && <Alert>{error}</Alert>}
          {aviso && (
            <p role="status" className="rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
              {aviso}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={restablecer.isPending}
              onClick={() => void volverALaPlantilla()}
            >
              Volver a la plantilla
            </Button>
          </div>
        </div>

        {/* La vista previa no usa las variables CSS: pinta con los colores del formulario, para
            que se vea el resultado antes de guardarlo y sin repintar la pantalla entera. */}
        <aside>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-suave">
            Así se va a ver
          </h2>
          <div
            className="overflow-hidden rounded-xl border border-borde"
            style={{ backgroundColor: paleta.fondo, color: paleta.texto }}
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ backgroundColor: '#FFFFFF', borderColor: derivados.suave }}
            >
              {logo ? (
                <img src={logo} alt="" className="max-h-7 max-w-28 object-contain" />
              ) : (
                <span className="font-extrabold" style={{ color: paleta.marca }}>
                  ENACTIVA Match
                </span>
              )}
              <span
                className="ml-auto rounded-md px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: derivados.suave, color: paleta.marca }}
              >
                Descubrir
              </span>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold">Taller de prevención de riesgos</p>
              <p className="text-xs opacity-80">Martes 10:00 · Sala de capacitación</p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: paleta.marca }}
                >
                  Inscribirme
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: `${paleta.acento}33`, color: '#7a5200' }}
                >
                  Quedan 3 cupos
                </span>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

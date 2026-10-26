import { CONFIRMACION_SUPRESION } from '@enactiva/shared';
import { useState } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDescargarMisDatos, useSuprimirCuenta } from '@/lib/datos-personales';

interface MisDatosProps {
  /**
   * Las cuentas del equipo ENACTIVA no se borran desde aquí: si el único Admin Principal se
   * suprimiera, nadie podría volver a administrar el piloto. El servidor también lo rechaza;
   * esto es para decirlo antes y no después de escribir la frase.
   */
  puedeEliminar: boolean;
}

/**
 * Llevarse sus datos y borrar su cuenta, sin pedírselo a nadie (Ley 21.719, SPEC §3.7).
 *
 * Que sean dos botones y no un correo a soporte es el punto: un derecho que depende de que
 * alguien conteste no es algo que la persona pueda ejercer.
 */
export function MisDatos({ puedeEliminar }: MisDatosProps) {
  const { cerrarSesion } = useSesion();
  const descargarDatos = useDescargarMisDatos();
  const suprimir = useSuprimirCuenta();

  const [preguntando, setPreguntando] = useState(false);
  const [escrito, setEscrito] = useState('');

  const confirmado = escrito.trim().toUpperCase() === CONFIRMACION_SUPRESION;

  const eliminar = async () => {
    await suprimir.mutateAsync();
    // La cuenta ya no existe: dejarla en pantalla sería mentirle a quien acaba de borrarla.
    await cerrarSesion();
  };

  return (
    <>
      <Card>
        <CardTitle>Tus datos y tu cuenta</CardTitle>
        <CardDescription>
          Puedes llevarte todo lo que la plataforma guarda sobre ti, o borrar tu cuenta. Son
          derechos tuyos y no hay que pedírselos a nadie.
        </CardDescription>

        {descargarDatos.isError && (
          <Alert className="mt-4">
            No pudimos preparar tu archivo. Vuelve a intentarlo en un momento.
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => descargarDatos.mutate()}
            disabled={descargarDatos.isPending}
          >
            {descargarDatos.isPending ? 'Preparando el archivo…' : 'Descargar mis datos'}
          </Button>
          {puedeEliminar && (
            <Button variant="peligro" onClick={() => setPreguntando(true)}>
              Eliminar mi cuenta
            </Button>
          )}
        </div>

        <p className="mt-3 text-xs text-texto-suave">
          El archivo trae lo que guardan los tres servicios: tu cuenta y tu perfil, los talleres que
          dictas y a los que vas, y lo que decidiste en Descubrir.
        </p>

        {!puedeEliminar && (
          <p className="mt-2 text-xs text-texto-suave">
            Tu cuenta es del equipo ENACTIVA y no se elimina desde aquí: pídelo al Admin Principal.
          </p>
        )}
      </Card>

      <Dialog
        abierto={preguntando}
        titulo="Eliminar mi cuenta"
        descripcion="Esto no se puede deshacer."
        onCerrar={() => {
          setPreguntando(false);
          setEscrito('');
        }}
      >
        <div className="space-y-4">
          <div className="text-sm text-texto-suave">
            <p>Se borran tu nombre, tu correo, tu contraseña, tu perfil y tus inscripciones.</p>
            <p className="mt-2">
              Quedan los talleres que dictaste, porque otras personas se inscribieron en ellos, y el
              registro de auditoría que exige la Ley 21.719. Ninguno de los dos dirá quién eras.
            </p>
          </div>

          {suprimir.isError && <Alert>{(suprimir.error as Error).message}</Alert>}

          <div>
            <Label htmlFor="confirmacion-supresion">
              Escribe <strong>{CONFIRMACION_SUPRESION}</strong> para confirmar
            </Label>
            <Input
              id="confirmacion-supresion"
              autoComplete="off"
              value={escrito}
              onChange={(evento) => setEscrito(evento.target.value)}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreguntando(false);
                setEscrito('');
              }}
            >
              Mejor no
            </Button>
            <Button
              variant="peligro"
              onClick={eliminar}
              disabled={!confirmado || suprimir.isPending}
            >
              {suprimir.isPending ? 'Eliminando…' : 'Eliminar mi cuenta'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

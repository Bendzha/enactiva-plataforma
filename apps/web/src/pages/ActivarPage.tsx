import { aceptarInvitacionSchema } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { AvisoPrivacidad } from '@/contenido/AvisoPrivacidad';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useEstadoInvitacion } from '@/lib/invitaciones';
import { destinoDe } from '@/lib/navegacion';

export function ActivarPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const navegar = useNavigate();
  const { activarCuenta } = useSesion();
  const { data: invitacion, isPending, isError, error } = useEstadoInvitacion(token);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [password, setPassword] = useState('');
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const validacion = aceptarInvitacionSchema.safeParse({
      token: token ?? '',
      nombre,
      apellido,
      password,
      aceptaAviso,
    });
    if (!validacion.success) {
      const porCampo: Record<string, string> = {};
      for (const issue of validacion.error.issues) {
        porCampo[String(issue.path[0])] = issue.message;
      }
      setErrores(porCampo);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      const usuario = await activarCuenta(validacion.data);
      navegar(destinoDe(usuario), { replace: true });
    } catch (e) {
      setErrorGeneral(
        e instanceof ErrorApi
          ? e.message
          : 'No pudimos activar tu cuenta. Inténtalo de nuevo más tarde.',
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!token || isError) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-sm">
          <CardTitle>Este enlace ya no sirve</CardTitle>
          <CardDescription>
            {error instanceof ErrorApi
              ? error.message
              : 'Falta el enlace de invitación. Pide que te lo reenvíen.'}
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2 font-extrabold tracking-tight text-marca">
          <span className="size-2.5 rounded-full bg-acento" aria-hidden="true" />
          ENACTIVA
        </div>

        <CardTitle>Activa tu cuenta</CardTitle>
        <CardDescription>
          {isPending
            ? 'Cargando tu invitación…'
            : invitacion?.nombreEmpresa
              ? `Invitación para ${invitacion.email}, de ${invitacion.nombreEmpresa}.`
              : `Invitación para ${invitacion?.email}, del equipo de ENACTIVA.`}
        </CardDescription>

        <form className="mt-6 space-y-4" onSubmit={enviar} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                aria-invalid={Boolean(errores.nombre)}
              />
              {errores.nombre && <p className="mt-1 text-xs text-peligro">{errores.nombre}</p>}
            </div>
            <div>
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                aria-invalid={Boolean(errores.apellido)}
              />
              {errores.apellido && <p className="mt-1 text-xs text-peligro">{errores.apellido}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="password">Crea tu contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errores.password)}
            />
            {errores.password && <p className="mt-1 text-xs text-peligro">{errores.password}</p>}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Aviso de privacidad</p>
            <AvisoPrivacidad />
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#00347A]"
                checked={aceptaAviso}
                onChange={(e) => setAceptaAviso(e.target.checked)}
                aria-invalid={Boolean(errores.aceptaAviso)}
              />
              <span>He leído y acepto el aviso de privacidad.</span>
            </label>
            {errores.aceptaAviso && (
              <p className="mt-1 text-xs text-peligro">{errores.aceptaAviso}</p>
            )}
          </div>

          {errorGeneral && <Alert>{errorGeneral}</Alert>}

          <Button type="submit" className="w-full" disabled={enviando || isPending}>
            {enviando ? 'Activando…' : 'Activar mi cuenta'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

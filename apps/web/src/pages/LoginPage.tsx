import { loginSchema } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { destinoDe } from '@/lib/navegacion';

export function LoginPage() {
  const { usuario, cargando, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cargando && usuario) {
    return <Navigate to={destinoDe(usuario)} replace />;
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);

    // Mismo esquema de validación que usa la API (packages/shared).
    const validacion = loginSchema.safeParse({ email, password });
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
      const persona = await iniciarSesion(validacion.data.email, validacion.data.password);
      const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? destinoDe(persona);
      navegar(destino, { replace: true });
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorApi && error.status === 401
          ? 'Email o contraseña incorrectos.'
          : 'No pudimos conectar con el servidor. Inténtalo de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 font-extrabold tracking-tight text-marca">
          <span className="size-2.5 rounded-full bg-acento" aria-hidden="true" />
          ENACTIVA
        </div>

        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa con la cuenta que te entregó tu organización.</CardDescription>

        <form className="mt-6 space-y-4" onSubmit={enviar} noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errores.email)}
              aria-describedby={errores.email ? 'error-email' : undefined}
            />
            {errores.email && (
              <p id="error-email" className="mt-1 text-xs text-peligro">
                {errores.email}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errores.password)}
              aria-describedby={errores.password ? 'error-password' : undefined}
            />
            {errores.password && (
              <p id="error-password" className="mt-1 text-xs text-peligro">
                {errores.password}
              </p>
            )}
          </div>

          {errorGeneral && <Alert>{errorGeneral}</Alert>}

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

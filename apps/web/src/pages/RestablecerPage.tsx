import { LARGO_MINIMO_PASSWORD, restablecerPasswordSchema } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Marca } from '@/components/marca/Marca';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi, pedir } from '@/lib/api';

/**
 * Elegir la contraseña nueva con el enlace del correo.
 *
 * No deja la sesión iniciada: al terminar manda al login. Entregar una sesión acá sería una
 * segunda forma de entrar, con sus propias reglas, y no hace falta.
 */
export function RestablecerPage() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const token = parametros.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);

    const validacion = restablecerPasswordSchema.safeParse({ token, password });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    setEnviando(true);
    try {
      await pedir<void>('/auth/restablecer', {
        method: 'POST',
        body: JSON.stringify(validacion.data),
      });
      navegar('/login', { replace: true, state: { restablecida: true } });
    } catch (problema) {
      setError(
        problema instanceof ErrorApi && problema.status === 410
          ? problema.message
          : 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <Marca className="mb-6" />

        {token ? (
          <>
            <CardTitle>Elige una contraseña nueva</CardTitle>
            <CardDescription>
              Al cambiarla se cierran las sesiones que tengas abiertas en otros dispositivos.
            </CardDescription>

            <form className="mt-6 space-y-4" onSubmit={enviar} noValidate>
              <div>
                <Label htmlFor="password">Contraseña nueva</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-texto-suave">
                  Al menos {LARGO_MINIMO_PASSWORD} caracteres.
                </p>
              </div>

              {error && <Alert>{error}</Alert>}

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Guardar y volver a entrar'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <CardTitle>Este enlace está incompleto</CardTitle>
            <CardDescription>
              Ábrelo desde el correo que te llegó, o pide uno nuevo.
            </CardDescription>
            <div className="mt-6">
              <Link to="/recuperar" className="text-sm font-semibold text-marca hover:underline">
                Pedir un enlace nuevo
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

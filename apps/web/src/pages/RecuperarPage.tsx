import { recuperarPasswordSchema } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Marca } from '@/components/marca/Marca';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pedir } from '@/lib/api';

/**
 * Pedir el enlace para volver a entrar.
 *
 * Responde lo mismo exista o no la cuenta, igual que el servidor: decir «ese correo no está
 * registrado» le diría a cualquiera quién trabaja en qué empresa.
 */
export function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);

    const validacion = recuperarPasswordSchema.safeParse({ email });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa el correo');
      return;
    }

    setEnviando(true);
    try {
      await pedir<void>('/auth/recuperar', {
        method: 'POST',
        body: JSON.stringify(validacion.data),
      });
      setListo(true);
    } catch {
      setError('No pudimos conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <Marca className="mb-6" />

        {listo ? (
          <>
            <CardTitle>Revisa tu correo</CardTitle>
            <CardDescription>
              Si esa dirección tiene una cuenta activa, le llegó un enlace para elegir una
              contraseña nueva. Vence en dos horas y sirve una sola vez.
            </CardDescription>
            <div className="mt-6">
              <Link to="/login" className="text-sm font-semibold text-marca hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          </>
        ) : (
          <>
            <CardTitle>¿Olvidaste tu contraseña?</CardTitle>
            <CardDescription>
              Escribe tu correo de la empresa y te mandamos un enlace para elegir una nueva.
            </CardDescription>

            <form className="mt-6 space-y-4" onSubmit={enviar} noValidate>
              <div>
                <Label htmlFor="email">Correo de la empresa</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <Alert>{error}</Alert>}

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviarme el enlace'}
              </Button>
            </form>

            <div className="mt-4">
              <Link to="/login" className="text-sm font-semibold text-marca hover:underline">
                Volver
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

import { loginSchema, participaEnLaRed, permisosDe, type UsuarioSesion } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Ilustracion } from '@/components/marca/Ilustracion';
import { Marca } from '@/components/marca/Marca';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { destinoDe } from '@/lib/navegacion';
import { cn } from '@/lib/utils';

/**
 * Las tres dimensiones del perfil, de adorno.
 *
 * Están para contar de qué va el producto antes de entrar, no para filtrar nada: elegir una
 * acá no tendría a dónde ir, porque el perfil ya las lleva declaradas por tema.
 */
const EJEMPLOS = [
  { id: 'actitud', texto: 'Actitud' },
  { id: 'conocimientos', texto: 'Conocimientos' },
  { id: 'habilidades', texto: 'Habilidades' },
] as const;

/**
 * A dónde entra la persona. No cambia permisos —el rol sale de la cuenta— y por eso es una
 * preferencia y no una credencial: si alguien de planta elige RRHH, entra igual y cae donde le
 * corresponde. Sirve para que quien administra no pase por Descubrir cada mañana.
 */
const PUERTAS = [
  { id: 'trabajador', texto: 'Trabajador/a', destino: '/descubrir' },
  { id: 'rrhh', texto: 'RRHH', destino: '/personas' },
] as const;

type Puerta = (typeof PUERTAS)[number]['id'];

/**
 * La preferencia solo vale si lleva a una pantalla que esa cuenta puede usar; si no, manda el
 * rol. Sin esto, alguien del equipo ENACTIVA que eligiera «Trabajador/a» caería en Descubrir,
 * que para una cuenta sin empresa no tiene nada que mostrar.
 */
function destinoElegido(puerta: Puerta, persona: UsuarioSesion): string | null {
  if (puerta === 'rrhh') {
    return permisosDe(persona.roles, persona.nivelAdmin).has('personas:gestionar')
      ? '/personas'
      : null;
  }
  // Quien administra no tiene Descubrir (2026-11-11): la puerta de «Trabajador/a» no lleva a
  // ninguna parte para RRHH, y entonces manda el destino propio de su cuenta.
  return persona.empresaId && participaEnLaRed(persona.roles) ? '/descubrir' : null;
}

export function LoginPage() {
  const { usuario, cargando, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ejemplo, setEjemplo] = useState<string>('conocimientos');
  const [puerta, setPuerta] = useState<Puerta>('trabajador');
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
      // Si venía de una pantalla protegida, esa manda: es a donde quería llegar.
      const desde = (ubicacion.state as { desde?: string } | null)?.desde;
      const destino = desde ?? destinoElegido(puerta, persona) ?? destinoDe(persona);
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Marca className="mb-6 text-xl" />

          <p className="mb-3 inline-block rounded-full bg-marca-suave px-3 py-1 text-xs font-bold tracking-widest text-marca uppercase">
            Match corporativo de aprendizaje
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">¡Hola de nuevo!</h1>
          <p className="mt-2 text-sm text-texto-suave">
            Conecta con colegas de tu empresa para enseñar lo que sabes y aprender lo que necesitas.
          </p>

          <div className="mt-6 rounded-xl border border-borde bg-white p-4">
            <p className="font-semibold">Crea tu match por actitud, conocimientos o habilidades</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EJEMPLOS.map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setEjemplo(opcion.id)}
                  aria-pressed={ejemplo === opcion.id}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    ejemplo === opcion.id
                      ? 'border-marca bg-marca-suave text-marca'
                      : 'border-borde bg-white text-texto hover:bg-marca-suave',
                  )}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-texto-suave">
              Conecta con quien sabe lo que necesitas aprender: datos, normativa, procesos,
              herramientas.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={enviar} noValidate>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-texto">Entro como</legend>
              <div className="flex flex-wrap gap-2">
                {PUERTAS.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setPuerta(opcion.id)}
                    aria-pressed={puerta === opcion.id}
                    className={cn(
                      'rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
                      puerta === opcion.id
                        ? 'border-marca bg-marca text-white'
                        : 'border-borde bg-white text-texto hover:bg-marca-suave',
                    )}
                  >
                    {opcion.texto}
                  </button>
                ))}
              </div>
              <p className="mt-2 rounded-md bg-marca-suave px-3 py-2 text-xs text-texto-suave">
                Solo decide en qué pantalla partes. Lo que puedes hacer lo define tu cuenta.
              </p>
            </fieldset>

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
                placeholder="Tu contraseña"
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

            <div className="flex justify-end">
              <Link to="/recuperar" className="text-sm font-semibold text-marca hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {errorGeneral && <Alert>{errorGeneral}</Alert>}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-6 text-xs text-texto-suave">
            ¿Aún no tienes acceso?{' '}
            <a href="mailto:contacto@enactiva.cl" className="font-semibold text-marca">
              Escríbenos
            </a>
            <br />
            ENACTIVA — a human learning company.
          </p>
        </div>
      </div>

      <Ilustracion />
    </div>
  );
}

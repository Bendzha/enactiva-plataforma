import { Link } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { botonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function InicioPage() {
  const { usuario } = useSesion();
  const deUnaEmpresa = Boolean(usuario?.empresaId);

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Hola{usuario?.nombre ? `, ${usuario.nombre}` : ''}
        </h1>
        <p className="text-sm text-texto-suave">Tu cuenta ya está activa.</p>
      </header>

      {deUnaEmpresa ? (
        <Card>
          <CardTitle>Parte por tu perfil</CardTitle>
          <CardDescription>
            Declara qué puedes enseñar y qué quieres aprender. Con eso la plataforma te va a
            emparejar con otras personas de tu organización.
          </CardDescription>
          <div className="mt-4">
            <Link to="/mi-perfil" className={botonVariants()}>
              Completar mi perfil
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Tu panel está en construcción</CardTitle>
          <CardDescription>
            Desde aquí vas a ver los talleres de las organizaciones del piloto y su evolución.
          </CardDescription>
        </Card>
      )}
    </section>
  );
}

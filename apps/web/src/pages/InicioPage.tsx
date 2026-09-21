import { useSesion } from '@/auth/sesion';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function InicioPage() {
  const { usuario } = useSesion();

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Hola{usuario?.nombre ? `, ${usuario.nombre}` : ''}
        </h1>
        <p className="text-sm text-texto-suave">Tu cuenta ya está activa.</p>
      </header>

      <Card>
        <CardTitle>Tu panel está en construcción</CardTitle>
        <CardDescription>
          Desde aquí vas a ver los cursos de tu organización y su evolución. Por ahora tu cuenta
          quedó lista y puedes cerrar sesión con seguridad.
        </CardDescription>
      </Card>
    </section>
  );
}

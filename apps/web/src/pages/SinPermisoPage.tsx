import { Link } from 'react-router';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function SinPermisoPage() {
  return (
    <Card>
      <CardTitle>No tienes acceso a esta sección</CardTitle>
      <CardDescription>
        Tu cuenta no tiene el permiso necesario. Si crees que es un error, habla con quien
        administra la plataforma en tu organización.
      </CardDescription>
      <Link to="/empresas" className="mt-4 inline-block text-sm font-semibold text-marca underline">
        Volver
      </Link>
    </Card>
  );
}

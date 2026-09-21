import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function EmpresasPage() {
  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Empresas piloto</h1>
        <p className="text-sm text-texto-suave">
          Todas las organizaciones activas en el piloto de ENACTIVA
        </p>
      </header>

      <Card>
        <CardTitle>Aún no hay empresas cargadas</CardTitle>
        <CardDescription>
          El listado, la ficha y el alta de empresas se construyen en el Slice 1. Esta pantalla ya
          está protegida: solo entra quien tiene el permiso para listar empresas.
        </CardDescription>
      </Card>
    </section>
  );
}

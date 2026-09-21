import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { useEmpresas } from '@/lib/empresas';

export function MetricasPage() {
  const { data: empresas } = useEmpresas();

  const activas = (empresas ?? []).filter((e) => e.estado === 'ACTIVA').length;
  const pendientes = (empresas ?? []).filter((e) => e.estado !== 'ACTIVA').length;
  const personas = (empresas ?? []).reduce((suma, e) => suma + e.personasActivas, 0);

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Métricas globales</h1>
        <p className="text-sm text-texto-suave">Resumen del piloto, solo para el Admin Principal</p>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Empresas activas" valor={empresas ? activas : '—'} />
        <Kpi etiqueta="En onboarding" valor={empresas ? pendientes : '—'} />
        <Kpi etiqueta="Personas activas" valor={empresas ? personas : '—'} />
      </div>

      <Card>
        <CardTitle>Logro por empresa: aún sin mediciones</CardTitle>
        <CardDescription>
          Los porcentajes de logro aparecerán cuando las empresas registren cursos y mediciones. No
          se muestran cifras de ejemplo.
        </CardDescription>
      </Card>
    </section>
  );
}

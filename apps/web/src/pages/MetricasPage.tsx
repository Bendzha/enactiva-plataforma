import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function MetricasPage() {
  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Métricas globales</h1>
        <p className="text-sm text-texto-suave">Resumen del piloto, solo para el Admin Principal</p>
      </header>

      <Card>
        <CardTitle>Aún sin mediciones</CardTitle>
        <CardDescription>
          Los indicadores aparecerán cuando las empresas registren cursos y mediciones. No se
          muestran cifras de ejemplo.
        </CardDescription>
      </Card>
    </section>
  );
}

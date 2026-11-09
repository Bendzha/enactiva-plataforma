import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { useEmpresas } from '@/lib/empresas';
import { useMetricasGlobales } from '@/lib/metricas';

export function MetricasPage() {
  const { data: empresas } = useEmpresas();
  const { data: intereses, isError } = useMetricasGlobales();

  const activas = (empresas ?? []).filter((e) => e.estado === 'ACTIVA').length;
  const pendientes = (empresas ?? []).filter((e) => e.estado !== 'ACTIVA').length;
  const personas = (empresas ?? []).reduce((suma, e) => suma + e.personasActivas, 0);

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Métricas globales</h1>
        <p className="text-sm text-texto-suave">Resumen del piloto, solo para el Admin Principal</p>
      </header>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Empresas activas" valor={empresas ? activas : '—'} />
        <Kpi etiqueta="En onboarding" valor={empresas ? pendientes : '—'} />
        <Kpi etiqueta="Personas activas" valor={empresas ? personas : '—'} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Personas con perfil" valor={intereses?.personasConPerfil ?? '—'} />
        <Kpi etiqueta="Temas declarados" valor={intereses?.temas ?? '—'} />
        <Kpi etiqueta="Declaraciones" valor={intereses?.declaraciones ?? '—'} />
      </div>

      {isError && <Alert>No pudimos cargar los intereses declarados. Actualiza la página.</Alert>}

      {intereses && (
        <Card className="mb-6">
          <CardTitle>Intereses por empresa</CardTitle>
          <CardDescription>
            Las brechas son temas que alguien quiere aprender y nadie de esa empresa puede enseñar:
            ahí hay una oportunidad de formación.
          </CardDescription>

          {intereses.empresas.length === 0 ? (
            <p className="mt-4 text-sm text-texto-suave">Todavía no hay empresas en el piloto.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs text-texto-suave">
                  <th className="pb-2 font-medium">Empresa</th>
                  <th className="pb-2 text-right font-medium">Con perfil</th>
                  <th className="pb-2 text-right font-medium">Temas</th>
                  <th className="pb-2 text-right font-medium">Declaraciones</th>
                  <th className="pb-2 text-right font-medium">Brechas</th>
                </tr>
              </thead>
              <tbody>
                {intereses.empresas.map((empresa) => (
                  <tr key={empresa.empresaId} className="border-b border-borde last:border-0">
                    <td className="py-2 font-medium">{empresa.nombre}</td>
                    <td className="py-2 text-right">
                      {empresa.personasConPerfil} de {empresa.personasActivas}
                    </td>
                    <td className="py-2 text-right">{empresa.temas}</td>
                    <td className="py-2 text-right">{empresa.declaraciones}</td>
                    <td className="py-2 text-right font-semibold">{empresa.brechas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </section>
  );
}

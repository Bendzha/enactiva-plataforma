import { useState } from 'react';
import { FichaEmpresa } from '@/components/empresas/FichaEmpresa';
import { FormularioEmpresa } from '@/components/empresas/FormularioEmpresa';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { useEmpresas } from '@/lib/empresas';

export function EmpresasPage() {
  const { data: empresas, isPending, isError } = useEmpresas();
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [empresaVisible, setEmpresaVisible] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const personasActivas = (empresas ?? []).reduce((suma, e) => suma + e.personasActivas, 0);

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Empresas piloto</h1>
          <p className="text-sm text-texto-suave">
            Todas las organizaciones activas en el piloto de ENACTIVA
          </p>
        </div>
        <Button onClick={() => setFormularioAbierto(true)}>+ Agregar empresa</Button>
      </header>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Empresas piloto" valor={empresas?.length ?? '—'} />
        <Kpi etiqueta="Personas activas" valor={empresas ? personasActivas : '—'} />
        {/* Sin mediciones todavía: no se inventa un porcentaje (SPEC §9). */}
        <Kpi etiqueta="Logro promedio global" valor="Aún sin mediciones" destacado={false} />
      </div>

      {isPending && <p className="text-sm text-texto-suave">Cargando empresas…</p>}

      {isError && <Alert>No pudimos cargar las empresas. Actualiza la página.</Alert>}

      {empresas?.length === 0 && (
        <Card>
          <CardTitle>Aún no hay empresas en el piloto</CardTitle>
          <CardDescription>
            Usa “Agregar empresa” para sumar la primera. Su contacto de RRHH recibirá una invitación
            por correo.
          </CardDescription>
        </Card>
      )}

      {empresas && empresas.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((empresa) => (
            <li key={empresa.id}>
              <button
                type="button"
                onClick={() => setEmpresaVisible(empresa.id)}
                className="h-full w-full rounded-xl border border-borde bg-white p-5 text-left shadow-sm transition-colors hover:border-marca"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold">{empresa.nombre}</h2>
                    <p className="text-xs text-texto-suave">{empresa.rubro}</p>
                  </div>
                  <Badge variant={empresa.estado === 'ACTIVA' ? 'activa' : 'pendiente'}>
                    {empresa.estado === 'ACTIVA' ? 'Activa' : 'Pendiente'}
                  </Badge>
                </div>
                <div className="mt-4 text-sm">
                  <span className="font-extrabold">{empresa.personasActivas}</span>{' '}
                  <span className="text-texto-suave">
                    {empresa.personasActivas === 1 ? 'persona activa' : 'personas activas'}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormularioEmpresa
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        onCreada={(nombre) => {
          setFormularioAbierto(false);
          setAviso(`${nombre} quedó en onboarding y su contacto de RRHH recibió la invitación.`);
        }}
      />

      <FichaEmpresa empresaId={empresaVisible} onCerrar={() => setEmpresaVisible(null)} />
    </section>
  );
}

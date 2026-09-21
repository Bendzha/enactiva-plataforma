import { ETIQUETAS_ROL, type ResultadoImportacion } from '@enactiva/shared';
import { useState } from 'react';
import { ImportarPersonas } from '@/components/personas/ImportarPersonas';
import { InvitarPersona } from '@/components/personas/InvitarPersona';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { usePersonas, useReenviarInvitacionPersona } from '@/lib/personas';

export function PersonasPage() {
  const { data: personas, isPending, isError } = usePersonas();
  const reenviar = useReenviarInvitacionPersona();
  const [invitarAbierto, setInvitarAbierto] = useState(false);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const activas = (personas ?? []).filter((p) => p.estado === 'ACTIVO').length;
  const invitadas = (personas ?? []).filter((p) => p.estado === 'INVITADO').length;

  const alImportar = (resultado: ResultadoImportacion) => {
    const areas =
      resultado.areasCreadas.length > 0
        ? ` Se crearon las áreas: ${resultado.areasCreadas.join(', ')}.`
        : '';
    setAviso(
      `Se invitó a ${resultado.invitadas} personas.` +
        (resultado.conError > 0 ? ` ${resultado.conError} filas quedaron fuera por errores.` : '') +
        areas,
    );
  };

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Personas</h1>
          <p className="text-sm text-texto-suave">
            Quiénes participan de la capacitación interna en tu organización
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportarAbierto(true)}>
            Importar CSV
          </Button>
          <Button onClick={() => setInvitarAbierto(true)}>+ Invitar persona</Button>
        </div>
      </header>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Personas activas" valor={personas ? activas : '—'} />
        <Kpi etiqueta="Invitaciones pendientes" valor={personas ? invitadas : '—'} />
        <Kpi etiqueta="Logro promedio" valor="Aún sin mediciones" destacado={false} />
      </div>

      {isPending && <p className="text-sm text-texto-suave">Cargando personas…</p>}
      {isError && <Alert>No pudimos cargar las personas. Actualiza la página.</Alert>}

      {personas?.length === 0 && (
        <Card>
          <CardTitle>Todavía no hay nadie cargado</CardTitle>
          <CardDescription>
            Invita a una persona o importa tu lista en CSV para partir.
          </CardDescription>
        </Card>
      )}

      {personas && personas.length > 0 && (
        <ul className="space-y-3">
          {personas.map((persona) => (
            <li
              key={persona.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-white p-4"
            >
              <div className="min-w-48 grow">
                <div className="font-semibold">
                  {persona.nombre
                    ? `${persona.nombre} ${persona.apellido ?? ''}`.trim()
                    : persona.email}
                </div>
                <div className="text-xs text-texto-suave">
                  {persona.nombre && `${persona.email} · `}
                  {persona.areaNombre ?? 'Sin área'}
                  {persona.cargo && ` · ${persona.cargo}`}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {persona.roles.map((rol) => (
                  <Badge key={rol} variant="neutro">
                    {ETIQUETAS_ROL[rol]}
                  </Badge>
                ))}
              </div>

              {persona.estado === 'INVITADO' && <Badge variant="pendiente">Invitada</Badge>}
              {persona.estado === 'SUSPENDIDO' && <Badge variant="neutro">Sin acceso</Badge>}

              {persona.estado === 'INVITADO' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reenviar.isPending}
                  onClick={async () => {
                    await reenviar.mutateAsync(persona.id);
                    setAviso(`Invitación reenviada a ${persona.email}.`);
                  }}
                >
                  Reenviar invitación
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <InvitarPersona
        abierto={invitarAbierto}
        onCerrar={() => setInvitarAbierto(false)}
        onInvitada={(email) => setAviso(`Invitación enviada a ${email}.`)}
      />

      <ImportarPersonas
        abierto={importarAbierto}
        onCerrar={() => setImportarAbierto(false)}
        onImportado={alImportar}
      />
    </section>
  );
}

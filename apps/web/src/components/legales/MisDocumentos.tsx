import { DOCUMENTOS_LEGALES, ETIQUETAS_DOCUMENTO, VERSIONES_LEGALES } from '@enactiva/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { AvisoPrivacidad } from '@/contenido/AvisoPrivacidad';
import { Terminos } from '@/contenido/Terminos';
import { useMisAceptaciones } from '@/lib/legales';

const CONTENIDO = {
  AVISO_PRIVACIDAD: <AvisoPrivacidad />,
  TERMINOS: <Terminos />,
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Los documentos que esta persona aceptó, para volver a leerlos (SPEC §3.7).
 *
 * Hasta ahora se veían una sola vez, al activar la cuenta: aceptar algo que después no se puede
 * releer es pedirle a alguien que confíe en su memoria.
 */
export function MisDocumentos() {
  const { data: estado } = useMisAceptaciones(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <Card className="mt-6">
      <CardTitle>Lo que aceptaste</CardTitle>
      <CardDescription>
        Puedes volver a leerlos cuando quieras. Si cambian, te los pedimos de nuevo al entrar.
      </CardDescription>

      <ul className="mt-4 space-y-3">
        {DOCUMENTOS_LEGALES.map((documento) => {
          const aceptada = estado?.aceptadas.find(
            (a) => a.documento === documento && a.version === VERSIONES_LEGALES[documento],
          );

          return (
            <li key={documento} className="rounded-md border border-borde p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-sm font-semibold">{ETIQUETAS_DOCUMENTO[documento]}</div>
                  <div className="text-xs text-texto-suave">
                    {aceptada
                      ? `Versión ${aceptada.version} · aceptada el ${fecha(aceptada.aceptadoAt)}`
                      : `Versión ${VERSIONES_LEGALES[documento]}`}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setAbierto(abierto === documento ? null : documento)}
                >
                  {abierto === documento ? 'Ocultar' : 'Leer'}
                </Button>
              </div>

              {abierto === documento && <div className="mt-3">{CONTENIDO[documento]}</div>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

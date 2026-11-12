import { ETIQUETAS_DOCUMENTO, type DocumentoLegal } from '@enactiva/shared';
import { useState, type ReactNode } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Marca } from '@/components/marca/Marca';
import { AvisoPrivacidad } from '@/contenido/AvisoPrivacidad';
import { Terminos } from '@/contenido/Terminos';
import { useAceptarDocumentos, useMisAceptaciones } from '@/lib/legales';

const TEXTOS: Record<DocumentoLegal, { contenido: ReactNode; casilla: string }> = {
  AVISO_PRIVACIDAD: {
    contenido: <AvisoPrivacidad />,
    casilla: 'He leído y acepto el aviso de privacidad.',
  },
  TERMINOS: {
    contenido: <Terminos />,
    casilla: 'He leído y acepto los términos y condiciones.',
  },
};

/**
 * Vuelve a pedir los documentos legales cuando su versión cambió (SPEC §3.7, Q21).
 *
 * Hasta ahora el aviso se aceptaba una sola vez, al activar la cuenta: si el texto cambiaba,
 * nadie lo volvía a ver y el registro decía que habían aceptado otra cosa.
 *
 * **Bloquea, no avisa.** Un banner que se puede cerrar no es una aceptación. Lo único que queda
 * disponible es salir: nadie queda encerrado por no aceptar.
 */
export function PuertaLegal({ children }: { children: ReactNode }) {
  const { usuario, cerrarSesion } = useSesion();
  const { data: estado, isPending } = useMisAceptaciones(Boolean(usuario));
  const aceptar = useAceptarDocumentos();

  const [marcados, setMarcados] = useState<DocumentoLegal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pendientes = estado?.pendientes ?? [];

  // Mientras no se sabe, se deja pasar: bloquear por una consulta en vuelo haría parpadear la
  // aplicación entera en cada carga.
  if (isPending || pendientes.length === 0) {
    return <>{children}</>;
  }

  const faltanPorMarcar = pendientes.filter((documento) => !marcados.includes(documento));

  const alternar = (documento: DocumentoLegal) =>
    setMarcados((actuales) =>
      actuales.includes(documento)
        ? actuales.filter((d) => d !== documento)
        : [...actuales, documento],
    );

  const enviar = async () => {
    setError(null);
    try {
      await aceptar.mutateAsync({ documentos: pendientes });
    } catch {
      setError('No pudimos registrar tu aceptación. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Marca className="mb-6" />

        <Card>
          <CardTitle>
            {pendientes.length === 1
              ? `Cambió el ${ETIQUETAS_DOCUMENTO[pendientes[0]!].toLowerCase()}`
              : 'Cambiaron nuestros documentos'}
          </CardTitle>
          <CardDescription>
            Para seguir usando la plataforma tienes que leerlo y aceptarlo. Si prefieres no hacerlo,
            puedes cerrar sesión.
          </CardDescription>

          <div className="mt-6 space-y-6">
            {pendientes.map((documento) => (
              <div key={documento}>
                <p className="mb-2 text-sm font-medium">{ETIQUETAS_DOCUMENTO[documento]}</p>
                {TEXTOS[documento].contenido}
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-marca"
                    checked={marcados.includes(documento)}
                    onChange={() => alternar(documento)}
                  />
                  <span>{TEXTOS[documento].casilla}</span>
                </label>
              </div>
            ))}

            {error && <Alert>{error}</Alert>}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={faltanPorMarcar.length > 0 || aceptar.isPending}
                onClick={() => void enviar()}
              >
                {aceptar.isPending ? 'Guardando…' : 'Aceptar y continuar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void cerrarSesion()}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

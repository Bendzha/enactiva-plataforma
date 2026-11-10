import { LARGO_MAXIMO_DETALLE, proponerTallerSchema, type TipoInteres } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useProponerTaller } from '@/lib/solicitudes';

interface Props {
  abierto: boolean;
  /** El tema que la persona escribió y no encontró en el catálogo. */
  tema: string;
  /** De qué lado viene: cambia lo que se le pide a RRHH, no la solicitud. */
  tipo: TipoInteres;
  onCerrar: () => void;
}

const TEXTOS: Record<TipoInteres, { titulo: string; ayuda: string; etiqueta: string }> = {
  ENSENAR: {
    titulo: 'Proponer un taller',
    ayuda: 'RRHH decide si agrega el tema al catálogo y crea el taller.',
    etiqueta: '¿Qué enseñarías? (opcional)',
  },
  APRENDER: {
    titulo: 'Pedir un taller',
    ayuda: 'RRHH decide si agrega el tema al catálogo y busca quién pueda enseñarlo.',
    etiqueta: '¿Por qué te interesa? (opcional)',
  },
};

/**
 * Proponerle a RRHH un tema que no está en el catálogo (SPEC §2).
 *
 * Reemplaza el aviso que solo decía «pídele a RRHH que lo agregue», que era todo lo que había y
 * que la clienta dio por mal hecho el 2026-10-29.
 */
export function ProponerTaller({ abierto, tema, tipo, onCerrar }: Props) {
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);
  const proponer = useProponerTaller();
  const textos = TEXTOS[tipo];

  const cerrar = () => {
    setDetalle('');
    setError(null);
    setEnviada(false);
    onCerrar();
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);

    const validacion = proponerTallerSchema.safeParse({ tema, detalle });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    try {
      await proponer.mutateAsync(validacion.data);
      setEnviada(true);
    } catch (problema) {
      // El 409 trae algo útil que decir: o el tema ya está en el catálogo, o ya lo propuso.
      setError(
        problema instanceof ErrorApi && problema.status === 409
          ? problema.message
          : 'No pudimos enviar tu solicitud. Inténtalo de nuevo.',
      );
    }
  };

  if (enviada) {
    return (
      <Dialog abierto={abierto} titulo="Enviada a RRHH" onCerrar={cerrar}>
        <p className="text-sm text-texto-suave">
          Tu solicitud sobre «{tema}» quedó pendiente. Puedes ver en qué queda, y el motivo si la
          rechazan, en «Mi perfil».
        </p>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={cerrar}>
            Listo
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog abierto={abierto} titulo={textos.titulo} descripcion={textos.ayuda} onCerrar={cerrar}>
      <form className="space-y-4" onSubmit={enviar} noValidate>
        <div>
          <Label htmlFor="tema-propuesto">Tema</Label>
          <p
            id="tema-propuesto"
            className="mt-1 rounded-md border border-borde bg-fondo px-3 py-2 text-sm font-semibold"
          >
            {tema}
          </p>
        </div>

        <div>
          <Label htmlFor="detalle">{textos.etiqueta}</Label>
          <textarea
            id="detalle"
            name="detalle"
            rows={4}
            maxLength={LARGO_MAXIMO_DETALLE}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="mt-1 w-full rounded-md border border-borde px-3 py-2 text-sm focus:border-marca focus:outline-none"
          />
          <p className="mt-1 text-xs text-texto-suave">
            No escribas datos personales tuyos ni de nadie.
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={proponer.isPending}>
            {proponer.isPending ? 'Enviando…' : 'Enviar a RRHH'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

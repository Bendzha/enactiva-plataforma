import {
  DIAS_SEMANA,
  ETIQUETAS_DIA_SEMANA,
  guardarDisponibilidadSchema,
  type DiaSemana,
  type FranjaDisponibilidad,
} from '@enactiva/shared';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuardarDisponibilidad, useMiDisponibilidad } from '@/lib/talleres';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: () => void;
}

/**
 * Cuándo puede enseñar esta persona, semana a semana (acta 2026-09-29).
 * Se guarda la semana completa de una vez, igual que la ve en pantalla.
 */
export function MiDisponibilidad({ abierto, onCerrar, onGuardado }: Props) {
  const { data: guardadas } = useMiDisponibilidad(abierto);
  const guardar = useGuardarDisponibilidad();

  const [franjas, setFranjas] = useState<FranjaDisponibilidad[]>([]);
  const [dia, setDia] = useState<DiaSemana>('LUNES');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('11:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guardadas) setFranjas(guardadas);
  }, [guardadas]);

  const agregar = () => {
    setError(null);
    const candidata = { dia, horaInicio, horaFin };
    const validacion = guardarDisponibilidadSchema.safeParse({
      franjas: [...franjas, candidata],
    });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa la franja');
      return;
    }
    setFranjas(validacion.data.franjas);
  };

  const quitar = (indice: number) => {
    setFranjas((actuales) => actuales.filter((_, i) => i !== indice));
  };

  const confirmar = async () => {
    setError(null);
    try {
      await guardar.mutateAsync({ franjas });
      onGuardado();
      onCerrar();
    } catch {
      setError('No pudimos guardar tu disponibilidad. Inténtalo de nuevo.');
    }
  };

  return (
    <Dialog
      abierto={abierto}
      titulo="Cuándo puedo enseñar"
      descripcion="Se repite todas las semanas. Quien quiera aprender va a ver estas franjas."
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        {franjas.length === 0 ? (
          <p className="text-sm text-texto-suave">Todavía no declaraste ninguna franja.</p>
        ) : (
          <ul className="space-y-2" aria-label="Mis franjas">
            {franjas.map((franja, indice) => (
              <li
                key={`${franja.dia}-${franja.horaInicio}-${franja.horaFin}`}
                className="flex items-center justify-between gap-2 rounded-md border border-borde px-3 py-2 text-sm"
              >
                <span>
                  <strong>{ETIQUETAS_DIA_SEMANA[franja.dia]}</strong> de {franja.horaInicio} a{' '}
                  {franja.horaFin}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => quitar(indice)}
                  aria-label={`Quitar ${ETIQUETAS_DIA_SEMANA[franja.dia]} de ${franja.horaInicio} a ${franja.horaFin}`}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2">
            <Label htmlFor="dia-franja">Día</Label>
            <select
              id="dia-franja"
              className="h-10 w-full rounded-md border border-borde bg-white px-3 text-sm"
              value={dia}
              onChange={(e) => setDia(e.target.value as DiaSemana)}
            >
              {DIAS_SEMANA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETAS_DIA_SEMANA[opcion]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="desde-franja">Desde</Label>
            <Input
              id="desde-franja"
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="hasta-franja">Hasta</Label>
            <Input
              id="hasta-franja"
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
            />
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          + Agregar franja
        </Button>

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardar.isPending} onClick={confirmar}>
            {guardar.isPending ? 'Guardando…' : 'Guardar disponibilidad'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

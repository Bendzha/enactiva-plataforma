import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useListaAsistencia, usePasarLista } from '@/lib/valoracion';

interface PasarListaProps {
  tallerId: string;
  tallerNombre: string;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}

/**
 * La lista de asistencia de un taller, para quien lo dictó (reunión 2026-10-29).
 *
 * Un checklist y nada más, como lo pidió la clienta. Lo único que agrega es decir **antes** de
 * cerrar cuántos tokens va a repartir: cerrar es irreversible y quien lo hace tiene derecho a
 * saber qué está firmando.
 */
export function PasarLista({ tallerId, tallerNombre, onCerrar, onListo }: PasarListaProps) {
  const { data: lista, isPending } = useListaAsistencia(tallerId);
  const pasar = usePasarLista(tallerId);

  // Arranca con lo que ya estuviera marcado; null (sin pasar lista) cuenta como ausente.
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const seleccion =
    marcados ??
    new Set((lista?.inscritos ?? []).filter((fila) => fila.asistio).map((fila) => fila.usuarioId));

  const alternar = (usuarioId: string) => {
    const siguiente = new Set(seleccion);
    if (siguiente.has(usuarioId)) siguiente.delete(usuarioId);
    else siguiente.add(usuarioId);
    setMarcados(siguiente);
  };

  const inscritos = lista?.inscritos ?? [];
  const fueronTodos = inscritos.length > 0 && seleccion.size === inscritos.length;

  const enviar = async (cerrar: boolean) => {
    try {
      const resultado = await pasar.mutateAsync({ asistieron: [...seleccion], cerrar });
      if (!cerrar) return;
      onListo(
        `Lista cerrada. Ganaste ${resultado.tokensParaQuienEnsena} ${
          resultado.tokensParaQuienEnsena === 1 ? 'token' : 'tokens'
        }, y ${resultado.personasQueGanaronToken} ${
          resultado.personasQueGanaronToken === 1 ? 'persona' : 'personas'
        } el suyo.`,
      );
    } catch {
      // El mensaje ya se muestra desde `pasar.error`.
    }
  };

  return (
    <Dialog abierto titulo="Pasar lista" descripcion={tallerNombre} onCerrar={onCerrar}>
      {pasar.isError && <Alert className="mb-4">{(pasar.error as Error).message}</Alert>}

      {isPending && <p className="text-sm text-texto-suave">Cargando a tu gente…</p>}

      {lista && inscritos.length === 0 && (
        <p className="text-sm text-texto-suave">
          No se inscribió nadie en este taller, así que no hay lista que pasar.
        </p>
      )}

      {lista && inscritos.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-texto-suave">
            Marca a quienes fueron. Al cerrar se entregan los tokens y la lista ya no se cambia.
          </p>

          <ul className="space-y-1">
            {inscritos.map((fila) => (
              <li key={fila.usuarioId}>
                <label className="flex items-center gap-3 rounded-lg border border-borde p-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#00347A]"
                    checked={seleccion.has(fila.usuarioId)}
                    onChange={() => alternar(fila.usuarioId)}
                  />
                  <span className="grow">
                    <span className="font-medium">{fila.nombre}</span>
                    {fila.email && (
                      <span className="block text-xs text-texto-suave">{fila.email}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <p className="rounded-md border border-marca/30 bg-marca-suave px-3 py-2 text-sm">
            Fueron {seleccion.size} de {inscritos.length}.{' '}
            {fueronTodos
              ? 'Como fueron todos, ganas un token extra.'
              : 'Si van todos, ganas un token extra.'}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => void enviar(false)} disabled={pasar.isPending}>
              Guardar sin cerrar
            </Button>
            <Button onClick={() => void enviar(true)} disabled={pasar.isPending}>
              {pasar.isPending ? 'Cerrando…' : 'Cerrar y entregar tokens'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

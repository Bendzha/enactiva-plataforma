import {
  crearTallerSchema,
  editarTallerSchema,
  type CrearTallerInput,
  type TallerResumen,
} from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useTemas } from '@/lib/perfil';
import { useEditarTaller, usePublicarTaller } from '@/lib/talleres';

interface Props {
  abierto: boolean;
  /** Si viene, se edita esa ficha en vez de publicar una nueva. */
  taller?: TallerResumen;
  onCerrar: () => void;
  onGuardado: (nombre: string) => void;
}

/** "2026-10-20" y "15:30" en el huso de quien escribe → el instante exacto que guarda la API. */
function aInstante(fecha: string, hora: string): string {
  const momento = new Date(`${fecha}T${hora}:00`);
  return Number.isNaN(momento.getTime()) ? '' : momento.toISOString();
}

function fechaDe(iso: string | undefined): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function horaDe(iso: string | undefined): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

/**
 * La ficha del taller, tal como la pidió la clienta en la reunión del 2026-09-29: nombre, fecha,
 * horario, cupo, objetivo, resultados esperados y dónde se hace. No hay archivos que subir.
 */
export function FormularioTaller({ abierto, taller, onCerrar, onGuardado }: Props) {
  const { data: temas } = useTemas('');
  const publicar = usePublicarTaller();
  const editar = useEditarTaller();

  const [temaId, setTemaId] = useState(taller?.temaId ?? '');
  const [nombre, setNombre] = useState(taller?.nombre ?? '');
  const [objetivo, setObjetivo] = useState(taller?.objetivo ?? '');
  const [resultados, setResultados] = useState(taller?.resultadosEsperados ?? '');
  const [ubicacion, setUbicacion] = useState(taller?.ubicacion ?? '');
  const [fecha, setFecha] = useState(fechaDe(taller?.inicioAt));
  const [desde, setDesde] = useState(horaDe(taller?.inicioAt));
  const [hasta, setHasta] = useState(horaDe(taller?.finAt));
  const [cupo, setCupo] = useState(String(taller?.cupo ?? 10));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const editando = Boolean(taller);

  const cerrar = () => {
    setErrores({});
    setErrorGeneral(null);
    onCerrar();
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const comun = {
      nombre,
      objetivo,
      resultadosEsperados: resultados,
      ubicacion,
      inicioAt: aInstante(fecha, desde),
      finAt: aInstante(fecha, hasta),
      cupo,
    };
    const validacion = editando
      ? editarTallerSchema.safeParse(comun)
      : crearTallerSchema.safeParse({ ...comun, temaId });

    if (!validacion.success) {
      const porCampo: Record<string, string> = {};
      for (const issue of validacion.error.issues) {
        porCampo[String(issue.path[0] ?? 'general')] = issue.message;
      }
      setErrores(porCampo);
      return;
    }

    setErrores({});
    try {
      if (taller) {
        await editar.mutateAsync({ id: taller.id, ...validacion.data });
      } else {
        await publicar.mutateAsync(validacion.data as CrearTallerInput);
      }
      onGuardado(nombre);
      cerrar();
    } catch (problema) {
      setErrorGeneral(
        problema instanceof ErrorApi
          ? problema.message
          : 'No pudimos guardar el taller. Inténtalo de nuevo.',
      );
    }
  };

  const guardando = publicar.isPending || editar.isPending;

  return (
    <Dialog
      abierto={abierto}
      titulo={editando ? 'Editar la ficha' : 'Publicar un taller'}
      descripcion="La actividad es presencial: esto es la convocatoria, no la clase."
      onCerrar={cerrar}
      variante="lateral"
    >
      <form className="space-y-4" onSubmit={enviar} noValidate>
        {!editando && (
          <div>
            <Label htmlFor="tema-taller">Tema</Label>
            <select
              id="tema-taller"
              className="h-10 w-full rounded-md border border-borde bg-white px-3 text-sm"
              value={temaId}
              onChange={(e) => setTemaId(e.target.value)}
            >
              <option value="">Elige un tema</option>
              {(temas ?? []).map((tema) => (
                <option key={tema.id} value={tema.id}>
                  {tema.nombre}
                </option>
              ))}
            </select>
            {errores.temaId && <p className="mt-1 text-xs text-peligro">{errores.temaId}</p>}
          </div>
        )}

        <div>
          <Label htmlFor="nombre-taller">Nombre del taller</Label>
          <Input
            id="nombre-taller"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Excel para turnos"
          />
          {errores.nombre && <p className="mt-1 text-xs text-peligro">{errores.nombre}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="fecha-taller">Fecha</Label>
            <Input
              id="fecha-taller"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="desde-taller">Desde</Label>
            <Input
              id="desde-taller"
              type="time"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="hasta-taller">Hasta</Label>
            <Input
              id="hasta-taller"
              type="time"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>
        {(errores.inicioAt || errores.finAt) && (
          <p className="text-xs text-peligro">{errores.inicioAt ?? errores.finAt}</p>
        )}

        <div>
          <Label htmlFor="ubicacion-taller">¿Dónde se hace?</Label>
          <Input
            id="ubicacion-taller"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ej: Sala de reuniones, segundo piso"
          />
          {errores.ubicacion && <p className="mt-1 text-xs text-peligro">{errores.ubicacion}</p>}
        </div>

        <div>
          <Label htmlFor="cupo-taller">Cupo</Label>
          <Input
            id="cupo-taller"
            type="number"
            min={1}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
          />
          {errores.cupo && <p className="mt-1 text-xs text-peligro">{errores.cupo}</p>}
        </div>

        <div>
          <Label htmlFor="objetivo-taller">Objetivo</Label>
          <textarea
            id="objetivo-taller"
            className="min-h-20 w-full rounded-md border border-borde bg-white px-3 py-2 text-sm"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="¿Para qué es este taller?"
          />
          {errores.objetivo && <p className="mt-1 text-xs text-peligro">{errores.objetivo}</p>}
        </div>

        <div>
          <Label htmlFor="resultados-taller">Resultados esperados</Label>
          <textarea
            id="resultados-taller"
            className="min-h-20 w-full rounded-md border border-borde bg-white px-3 py-2 text-sm"
            value={resultados}
            onChange={(e) => setResultados(e.target.value)}
            placeholder="¿Con qué se va quien asista?"
          />
          {errores.resultadosEsperados && (
            <p className="mt-1 text-xs text-peligro">{errores.resultadosEsperados}</p>
          )}
        </div>

        {errorGeneral && <Alert>{errorGeneral}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar taller'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

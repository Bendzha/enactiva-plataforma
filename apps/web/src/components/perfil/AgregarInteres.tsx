import {
  declararInteresSchema,
  DIMENSIONES,
  ETIQUETAS_DIMENSION,
  ETIQUETAS_NIVEL_DOMINIO,
  NIVELES_DOMINIO,
  normalizarNombre,
  type Dimension,
  type NivelDominio,
  type TipoInteres,
} from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useCrearTema, useDeclararInteres, useTemas } from '@/lib/perfil';
import { cn } from '@/lib/utils';

interface Props {
  abierto: boolean;
  tipo: TipoInteres;
  onCerrar: () => void;
  onDeclarado: (temaNombre: string) => void;
}

const TEXTOS: Record<TipoInteres, { titulo: string; nivel: string }> = {
  ENSENAR: {
    titulo: 'Agregar algo que puedo enseñar',
    nivel: '¿Cuánto lo dominas?',
  },
  APRENDER: {
    titulo: 'Agregar algo que quiero aprender',
    nivel: '¿Desde dónde partes?',
  },
};

export function AgregarInteres({ abierto, tipo, onCerrar, onDeclarado }: Props) {
  const { puede } = useSesion();
  const [busqueda, setBusqueda] = useState('');
  const [temaId, setTemaId] = useState('');
  const [dimensiones, setDimensiones] = useState<Dimension[]>([]);
  const [nivel, setNivel] = useState<NivelDominio>('INTERMEDIO');
  const [error, setError] = useState<string | null>(null);

  const { data: temas } = useTemas(busqueda);
  const crearTema = useCrearTema();
  const declarar = useDeclararInteres();

  const textos = TEXTOS[tipo];
  const nombreBuscado = busqueda.trim();
  const existeIgual = (temas ?? []).some(
    (tema) => normalizarNombre(tema.nombre) === normalizarNombre(nombreBuscado),
  );
  const puedeCrear = puede('temas:crear') && nombreBuscado.length >= 2 && !existeIgual;
  const temaElegido = (temas ?? []).find((tema) => tema.id === temaId);

  const cerrar = () => {
    setBusqueda('');
    setTemaId('');
    setDimensiones([]);
    setNivel('INTERMEDIO');
    setError(null);
    onCerrar();
  };

  const alternarDimension = (dimension: Dimension) => {
    setDimensiones((actuales) =>
      actuales.includes(dimension)
        ? actuales.filter((d) => d !== dimension)
        : [...actuales, dimension],
    );
  };

  const crearYElegir = async () => {
    setError(null);
    try {
      const tema = await crearTema.mutateAsync(nombreBuscado);
      setTemaId(tema.id);
      setBusqueda(tema.nombre);
    } catch (problema) {
      setError(
        problema instanceof ErrorApi && problema.status === 409
          ? 'Ese tema ya existe: búscalo en la lista.'
          : 'No pudimos crear el tema. Inténtalo de nuevo.',
      );
    }
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);

    const validacion = declararInteresSchema.safeParse({ temaId, tipo, dimensiones, nivel });
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    try {
      const declarado = await declarar.mutateAsync(validacion.data);
      onDeclarado(declarado.temaNombre);
      cerrar();
    } catch (problema) {
      setError(
        problema instanceof ErrorApi && problema.status === 409
          ? 'Ya tenías ese tema declarado aquí.'
          : 'No pudimos guardar tu declaración. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <Dialog
      abierto={abierto}
      titulo={textos.titulo}
      descripcion="Busca el tema en el catálogo de tu organización antes de crear uno nuevo."
      onCerrar={cerrar}
    >
      <form className="space-y-4" onSubmit={enviar} noValidate>
        <div>
          <Label htmlFor="buscar-tema">Tema</Label>
          <Input
            id="buscar-tema"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setTemaId('');
            }}
            placeholder="Ej: Excel avanzado"
            autoComplete="off"
          />

          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto" aria-label="Temas del catálogo">
            {(temas ?? []).map((tema) => (
              <li key={tema.id}>
                <button
                  type="button"
                  onClick={() => setTemaId(tema.id)}
                  aria-pressed={temaId === tema.id}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm',
                    temaId === tema.id
                      ? 'bg-marca-suave font-semibold text-marca'
                      : 'hover:bg-marca-suave/50',
                  )}
                >
                  {tema.nombre}
                  <span className="ml-2 text-xs text-texto-suave">
                    {tema.puedenEnsenar} pueden enseñarlo · {tema.quierenAprender} quieren
                    aprenderlo
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {temas?.length === 0 && !puedeCrear && (
            <p className="mt-2 text-xs text-texto-suave">
              No hay temas que coincidan. Pídele a RRHH que agregue el tema al catálogo.
            </p>
          )}

          {puedeCrear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={crearTema.isPending}
              onClick={crearYElegir}
            >
              {crearTema.isPending ? 'Creando…' : `+ Crear el tema "${nombreBuscado}"`}
            </Button>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-texto">
            ¿Qué se pone en juego? Elige una o más
          </legend>
          <div className="flex flex-wrap gap-4">
            {DIMENSIONES.map((dimension) => (
              <label key={dimension} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[#00347A]"
                  checked={dimensiones.includes(dimension)}
                  onChange={() => alternarDimension(dimension)}
                />
                {ETIQUETAS_DIMENSION[dimension]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="nivel-interes">{textos.nivel}</Label>
          <select
            id="nivel-interes"
            className="h-10 w-full rounded-md border border-borde bg-white px-3 text-sm"
            value={nivel}
            onChange={(e) => setNivel(e.target.value as NivelDominio)}
          >
            {NIVELES_DOMINIO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETAS_NIVEL_DOMINIO[opcion]}
              </option>
            ))}
          </select>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-end gap-2 pt-2">
          {temaElegido && (
            <span className="mr-auto text-xs text-texto-suave">
              Tema elegido: <strong>{temaElegido.nombre}</strong>
            </span>
          )}
          <Button type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={declarar.isPending}>
            {declarar.isPending ? 'Guardando…' : 'Agregar'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

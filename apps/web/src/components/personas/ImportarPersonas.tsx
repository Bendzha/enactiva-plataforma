import { MAXIMO_FILAS_IMPORTACION, type ResultadoImportacion } from '@enactiva/shared';
import { useState, type ChangeEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorApi } from '@/lib/api';
import { useImportarPersonas, useVistaPreviaImportacion } from '@/lib/personas';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onImportado: (resultado: ResultadoImportacion) => void;
}

export function ImportarPersonas({ abierto, onCerrar, onImportado }: Props) {
  const [contenido, setContenido] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vistaPrevia = useVistaPreviaImportacion();
  const importar = useImportarPersonas();

  const cerrar = () => {
    setContenido(null);
    setNombreArchivo(null);
    setError(null);
    vistaPrevia.reset();
    importar.reset();
    onCerrar();
  };

  const elegirArchivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    setError(null);
    setNombreArchivo(archivo.name);
    const texto = await archivo.text();
    setContenido(texto);

    try {
      await vistaPrevia.mutateAsync(texto);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos leer el archivo.');
    }
  };

  const confirmar = async () => {
    if (!contenido) return;
    setError(null);
    try {
      const resultado = await importar.mutateAsync(contenido);
      onImportado(resultado);
      cerrar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos importar el archivo.');
    }
  };

  const filas = vistaPrevia.data?.filas ?? [];

  return (
    <Dialog
      abierto={abierto}
      titulo="Importar colaboradores"
      descripcion={`Archivo CSV con las columnas email, roles, área y cargo. Hasta ${MAXIMO_FILAS_IMPORTACION} filas.`}
      onCerrar={cerrar}
      variante="lateral"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="archivo-csv" className="mb-1.5 block text-sm font-medium text-texto">
            Archivo CSV
          </label>
          <input
            id="archivo-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={elegirArchivo}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marca file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {nombreArchivo && <p className="mt-1 text-xs text-texto-suave">{nombreArchivo}</p>}
        </div>

        {vistaPrevia.isPending && <p className="text-sm text-texto-suave">Revisando el archivo…</p>}
        {error && <Alert>{error}</Alert>}

        {vistaPrevia.data && (
          <>
            <p role="status" className="text-sm">
              <strong>{vistaPrevia.data.validas}</strong> filas listas para invitar y{' '}
              <strong>{vistaPrevia.data.conError}</strong> con problemas.
            </p>

            <div className="max-h-72 overflow-auto rounded-md border border-borde">
              <table className="w-full text-left text-xs">
                <thead className="bg-fondo text-texto-suave">
                  <tr>
                    <th className="p-2">Fila</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Roles</th>
                    <th className="p-2">Área</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.fila} className="border-t border-borde">
                      <td className="p-2">{fila.fila}</td>
                      <td className="p-2">{fila.email || '—'}</td>
                      <td className="p-2">{fila.roles.join(', ')}</td>
                      <td className="p-2">
                        {fila.area ?? '—'}
                        {fila.areaNueva && <span className="text-texto-suave"> (nueva)</span>}
                      </td>
                      <td className={`p-2 ${fila.error ? 'text-peligro' : 'text-marca'}`}>
                        {fila.error ?? 'Se invitará'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button
                disabled={importar.isPending || vistaPrevia.data.validas === 0}
                onClick={confirmar}
              >
                {importar.isPending
                  ? 'Importando…'
                  : `Invitar a ${vistaPrevia.data.validas} personas`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

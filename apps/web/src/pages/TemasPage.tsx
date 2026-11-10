import { normalizarNombre } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useCrearTema, useTemas } from '@/lib/perfil';

/**
 * El catálogo de temas de la empresa (SPEC §3.6).
 *
 * Desde el 2026-10-29 el catálogo es de RRHH, pero hasta ahora el único lugar donde se podía crear
 * un tema era el diálogo de «Mi perfil», que sirve para declarar lo de uno: RRHH tenía que entrar
 * a su propio perfil y declarar que enseña algo para poder agregarlo. Esta pantalla lo arregla.
 */
export function TemasPage() {
  const [busqueda, setBusqueda] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: temas, isPending } = useTemas(busqueda);
  const crear = useCrearTema();

  const propuesto = nombre.trim();
  const yaExiste = (temas ?? []).some(
    (tema) => normalizarNombre(tema.nombre) === normalizarNombre(propuesto),
  );

  const agregar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setAviso(null);

    if (propuesto.length < 2) {
      setError('Escribe el nombre del tema');
      return;
    }

    try {
      const tema = await crear.mutateAsync(propuesto);
      setAviso(`«${tema.nombre}» quedó en el catálogo.`);
      setNombre('');
      setBusqueda('');
    } catch (problema) {
      setError(
        problema instanceof ErrorApi && problema.status === 409
          ? 'Ese tema ya existe: búscalo en la lista.'
          : 'No pudimos crear el tema. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Temas</h1>
        <p className="text-sm text-texto-suave">
          El catálogo de tu organización. Es con lo que tu gente declara qué puede enseñar y qué
          quiere aprender, y de ahí salen los talleres.
        </p>
      </div>

      <Card>
        <CardTitle>Agregar un tema</CardTitle>
        <CardDescription>
          Busca antes de crear: «Excel» y «excel avanzado» como temas distintos romperían el
          emparejamiento.
        </CardDescription>

        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={agregar} noValidate>
          <div className="min-w-64 flex-1">
            <Label htmlFor="nombre-tema">Nombre del tema</Label>
            <Input
              id="nombre-tema"
              value={nombre}
              placeholder="Ej: Lectura de planos eléctricos"
              autoComplete="off"
              onChange={(e) => {
                setNombre(e.target.value);
                setBusqueda(e.target.value);
              }}
            />
          </div>
          <Button type="submit" disabled={crear.isPending || yaExiste}>
            {crear.isPending ? 'Creando…' : 'Agregar al catálogo'}
          </Button>
        </form>

        {yaExiste && propuesto.length >= 2 && (
          <p className="mt-2 text-xs text-texto-suave">«{propuesto}» ya está en el catálogo.</p>
        )}
        {aviso && (
          <p role="status" className="mt-3 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
            {aviso}
          </p>
        )}
        {error && <Alert className="mt-3">{error}</Alert>}
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="text-lg font-bold">En el catálogo</h2>
          <div className="ml-auto min-w-56">
            <Label htmlFor="buscar-catalogo">Buscar</Label>
            <Input
              id="buscar-catalogo"
              value={busqueda}
              placeholder="Filtrar por nombre"
              autoComplete="off"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {isPending ? (
          <p className="text-sm text-texto-suave">Cargando…</p>
        ) : (temas ?? []).length === 0 ? (
          <Card>
            <CardTitle>
              {busqueda.trim() ? 'Ningún tema coincide' : 'El catálogo está vacío'}
            </CardTitle>
            <CardDescription>
              {busqueda.trim()
                ? 'Prueba con otra palabra, o agrégalo arriba.'
                : 'Agrega el primero arriba, o espera a que tu gente proponga alguno desde su perfil.'}
            </CardDescription>
          </Card>
        ) : (
          <ul className="space-y-2">
            {(temas ?? []).map((tema) => (
              <li
                key={tema.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-borde bg-white px-4 py-3"
              >
                <span className="font-semibold">{tema.nombre}</span>
                <span className="ml-auto text-sm text-texto-suave">
                  {tema.puedenEnsenar} pueden enseñarlo · {tema.quierenAprender} quieren aprenderlo
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

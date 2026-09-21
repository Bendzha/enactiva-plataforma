import {
  crearAdminSchema,
  ETIQUETAS_NIVEL_ADMIN,
  NIVELES_ADMIN,
  type AdminResumen,
  type NivelAdmin,
} from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { useSesion } from '@/auth/sesion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useAdmins, useDesactivarAdmin, useInvitarAdmin } from '@/lib/admins';

export function EquipoPage() {
  const { usuario } = useSesion();
  const { data: admins, isPending, isError } = useAdmins();
  const invitar = useInvitarAdmin();
  const desactivar = useDesactivarAdmin();

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [nivelAdmin, setNivelAdmin] = useState<NivelAdmin>('OPERATIVO');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [porDesactivar, setPorDesactivar] = useState<AdminResumen | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrarFormulario = () => {
    setFormularioAbierto(false);
    setEmail('');
    setNivelAdmin('OPERATIVO');
    setErrores({});
    setErrorFormulario(null);
  };

  const enviarInvitacion = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorFormulario(null);

    const validacion = crearAdminSchema.safeParse({ email, nivelAdmin });
    if (!validacion.success) {
      const porCampo: Record<string, string> = {};
      for (const issue of validacion.error.issues) {
        porCampo[String(issue.path[0])] = issue.message;
      }
      setErrores(porCampo);
      return;
    }

    setErrores({});
    try {
      const creado = await invitar.mutateAsync(validacion.data);
      cerrarFormulario();
      setAviso(`Invitación enviada a ${creado.email}.`);
    } catch (error) {
      setErrorFormulario(
        error instanceof ErrorApi && error.status === 409
          ? 'Ese email ya tiene una cuenta en la plataforma.'
          : 'No pudimos enviar la invitación. Inténtalo de nuevo.',
      );
    }
  };

  const confirmarDesactivar = async () => {
    if (!porDesactivar) return;
    try {
      await desactivar.mutateAsync(porDesactivar.id);
      setAviso(`${porDesactivar.email} ya no tiene acceso a la plataforma.`);
    } catch (error) {
      setAviso(error instanceof ErrorApi ? error.message : 'No pudimos desactivar esa cuenta.');
    } finally {
      setPorDesactivar(null);
    }
  };

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Equipo ENACTIVA</h1>
          <p className="text-sm text-texto-suave">
            Quiénes administran la plataforma y con qué nivel de acceso
          </p>
        </div>
        <Button onClick={() => setFormularioAbierto(true)}>+ Invitar a alguien</Button>
      </header>

      {aviso && (
        <p role="status" className="mb-6 rounded-md bg-marca-suave px-3 py-2 text-sm text-marca">
          {aviso}
        </p>
      )}

      {isPending && <p className="text-sm text-texto-suave">Cargando equipo…</p>}
      {isError && <Alert>No pudimos cargar el equipo. Actualiza la página.</Alert>}

      {admins && (
        <ul className="space-y-3">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-white p-4"
            >
              <div className="min-w-48 grow">
                <div className="font-semibold">
                  {admin.nombre ? `${admin.nombre} ${admin.apellido ?? ''}`.trim() : admin.email}
                </div>
                {admin.nombre && <div className="text-xs text-texto-suave">{admin.email}</div>}
              </div>

              <Badge variant={admin.nivelAdmin === 'PRINCIPAL' ? 'activa' : 'neutro'}>
                {ETIQUETAS_NIVEL_ADMIN[admin.nivelAdmin]}
              </Badge>

              {admin.estado === 'INVITADO' && <Badge variant="pendiente">Invitación enviada</Badge>}
              {admin.estado === 'SUSPENDIDO' && <Badge variant="neutro">Sin acceso</Badge>}

              {admin.id !== usuario?.id && admin.estado !== 'SUSPENDIDO' && (
                <Button variant="outline" size="sm" onClick={() => setPorDesactivar(admin)}>
                  Quitar acceso
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        abierto={formularioAbierto}
        titulo="Invitar a alguien del equipo"
        descripcion="Recibirá un correo para activar su cuenta y elegir su contraseña."
        onCerrar={cerrarFormulario}
      >
        <form className="space-y-4" onSubmit={enviarInvitacion} noValidate>
          <div>
            <Label htmlFor="email-admin">Email</Label>
            <Input
              id="email-admin"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@enactiva.cl"
              aria-invalid={Boolean(errores.email)}
            />
            {errores.email && <p className="mt-1 text-xs text-peligro">{errores.email}</p>}
          </div>

          <div>
            <Label htmlFor="nivel-admin">Nivel de acceso</Label>
            <select
              id="nivel-admin"
              className="h-10 w-full rounded-md border border-borde bg-white px-3 text-sm"
              value={nivelAdmin}
              onChange={(e) => setNivelAdmin(e.target.value as NivelAdmin)}
            >
              {NIVELES_ADMIN.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {ETIQUETAS_NIVEL_ADMIN[nivel]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-texto-suave">
              Operativo carga empresas y envía invitaciones. Principal además activa empresas, ve
              las métricas y gestiona al equipo.
            </p>
          </div>

          {errorFormulario && <Alert>{errorFormulario}</Alert>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={cerrarFormulario}>
              Cancelar
            </Button>
            <Button type="submit" disabled={invitar.isPending}>
              {invitar.isPending ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        abierto={porDesactivar !== null}
        titulo="¿Quitar el acceso?"
        onCerrar={() => setPorDesactivar(null)}
      >
        <CardDescription>
          {porDesactivar?.email} perderá el acceso de inmediato y se cerrarán sus sesiones abiertas.
          Su historial en la auditoría se conserva.
        </CardDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPorDesactivar(null)}>
            Cancelar
          </Button>
          <Button disabled={desactivar.isPending} onClick={confirmarDesactivar}>
            {desactivar.isPending ? 'Quitando…' : 'Quitar acceso'}
          </Button>
        </div>
      </Dialog>

      {admins?.length === 0 && (
        <Card>
          <CardTitle>Todavía no hay nadie más en el equipo</CardTitle>
          <CardDescription>Invita a quien te ayudará a administrar la plataforma.</CardDescription>
        </Card>
      )}
    </section>
  );
}

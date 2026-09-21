import {
  ETIQUETAS_ROL,
  invitarPersonaSchema,
  ROLES_INVITABLES,
  type RolInvitable,
} from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorApi } from '@/lib/api';
import { useAreas, useInvitarPersona } from '@/lib/personas';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onInvitada: (email: string) => void;
}

export function InvitarPersona({ abierto, onCerrar, onInvitada }: Props) {
  const { data: areas } = useAreas();
  const invitar = useInvitarPersona();

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<RolInvitable[]>(['ESTUDIANTE']);
  const [areaId, setAreaId] = useState('');
  const [cargo, setCargo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const cerrar = () => {
    setEmail('');
    setRoles(['ESTUDIANTE']);
    setAreaId('');
    setCargo('');
    setErrores({});
    setErrorGeneral(null);
    onCerrar();
  };

  const alternarRol = (rol: RolInvitable) => {
    setRoles((actuales) =>
      actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol],
    );
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const validacion = invitarPersonaSchema.safeParse({
      email,
      roles,
      ...(areaId ? { areaId } : {}),
      ...(cargo.trim() ? { cargo } : {}),
    });
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
      const persona = await invitar.mutateAsync(validacion.data);
      onInvitada(persona.email);
      cerrar();
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorApi && error.status === 409
          ? 'Ese email ya tiene una cuenta en la plataforma.'
          : 'No pudimos enviar la invitación. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <Dialog
      abierto={abierto}
      titulo="Invitar a una persona"
      descripcion="Recibirá un correo para activar su cuenta y elegir su contraseña."
      onCerrar={cerrar}
    >
      <form className="space-y-4" onSubmit={enviar} noValidate>
        <div>
          <Label htmlFor="email-persona">Email</Label>
          <Input
            id="email-persona"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@empresa.cl"
            aria-invalid={Boolean(errores.email)}
          />
          {errores.email && <p className="mt-1 text-xs text-peligro">{errores.email}</p>}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-texto">¿Qué podrá hacer?</legend>
          <div className="flex gap-4">
            {ROLES_INVITABLES.map((rol) => (
              <label key={rol} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[#00347A]"
                  checked={roles.includes(rol)}
                  onChange={() => alternarRol(rol)}
                />
                {ETIQUETAS_ROL[rol]}
              </label>
            ))}
          </div>
          {errores.roles && <p className="mt-1 text-xs text-peligro">{errores.roles}</p>}
        </fieldset>

        <div>
          <Label htmlFor="area-persona">Área</Label>
          <select
            id="area-persona"
            className="h-10 w-full rounded-md border border-borde bg-white px-3 text-sm"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
          >
            <option value="">Sin área</option>
            {(areas ?? []).map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="cargo-persona">Cargo (opcional)</Label>
          <Input
            id="cargo-persona"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ej: Analista de Procesos"
          />
        </div>

        {errorGeneral && <Alert>{errorGeneral}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={invitar.isPending}>
            {invitar.isPending ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

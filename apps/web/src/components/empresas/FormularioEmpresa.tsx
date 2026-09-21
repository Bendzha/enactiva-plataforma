import { crearEmpresaSchema } from '@enactiva/shared';
import { useState, type FormEvent } from 'react';
import { useCrearEmpresa } from '@/lib/empresas';
import { ErrorApi } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: (nombre: string) => void;
}

export function FormularioEmpresa({ abierto, onCerrar, onCreada }: Props) {
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState('');
  const [emailRrhh, setEmailRrhh] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const crear = useCrearEmpresa();

  const limpiar = () => {
    setNombre('');
    setRubro('');
    setEmailRrhh('');
    setErrores({});
    setErrorGeneral(null);
  };

  const cerrar = () => {
    limpiar();
    onCerrar();
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErrorGeneral(null);

    const validacion = crearEmpresaSchema.safeParse({ nombre, rubro, emailRrhh });
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
      const empresa = await crear.mutateAsync(validacion.data);
      onCreada(empresa.nombre);
      limpiar();
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorApi && error.status === 409
          ? 'Ese email ya tiene una cuenta en la plataforma.'
          : 'No pudimos crear la empresa. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <Dialog
      abierto={abierto}
      titulo="Agregar nueva empresa"
      descripcion="Se sumará al piloto en estado de onboarding y su contacto de RRHH recibirá una invitación por correo."
      onCerrar={cerrar}
    >
      <form className="space-y-4" onSubmit={enviar} noValidate>
        <div>
          <Label htmlFor="nombre">Nombre de la empresa</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Comercial Rioclaro Ltda."
            aria-invalid={Boolean(errores.nombre)}
          />
          {errores.nombre && <p className="mt-1 text-xs text-peligro">{errores.nombre}</p>}
        </div>

        <div>
          <Label htmlFor="rubro">Rubro</Label>
          <Input
            id="rubro"
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            placeholder="Ej: Minería"
            aria-invalid={Boolean(errores.rubro)}
          />
          {errores.rubro && <p className="mt-1 text-xs text-peligro">{errores.rubro}</p>}
        </div>

        <div>
          <Label htmlFor="emailRrhh">Contacto de RRHH (email)</Label>
          <Input
            id="emailRrhh"
            type="email"
            value={emailRrhh}
            onChange={(e) => setEmailRrhh(e.target.value)}
            placeholder="contacto@empresa.cl"
            aria-invalid={Boolean(errores.emailRrhh)}
          />
          {errores.emailRrhh && <p className="mt-1 text-xs text-peligro">{errores.emailRrhh}</p>}
        </div>

        {errorGeneral && <Alert>{errorGeneral}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Agregando…' : 'Agregar empresa'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

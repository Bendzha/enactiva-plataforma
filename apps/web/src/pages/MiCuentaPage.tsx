import { ETIQUETAS_ROL } from '@enactiva/shared';
import { useSesion } from '@/auth/sesion';
import { MisDatos } from '@/components/perfil/MisDatos';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

/**
 * La cuenta de quien administra: RRHH y el equipo de ENACTIVA (2026-11-11).
 *
 * No hay perfil corporativo acá. Quien administra la participación de otros no declara lo que
 * sabe ni se inscribe en talleres; esa parte vive en «Mi perfil» y es de quien participa.
 *
 * Lo que sí está es el derecho a llevarse los datos propios (Ley 21.719, SPEC §3.7): no depende
 * del rol de nadie.
 */
export function MiCuentaPage() {
  const { usuario } = useSesion();

  return (
    <section>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Mi cuenta</h1>
      </header>

      <div className="space-y-6">
        <Card>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>
            Tu cuenta administra la plataforma dentro de tu organización.
          </CardDescription>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-texto-suave">Nombre</dt>
              <dd className="font-semibold">
                {[usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave">Correo</dt>
              <dd className="font-semibold">{usuario?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave">Rol</dt>
              <dd className="font-semibold">
                {usuario?.roles.map((rol) => ETIQUETAS_ROL[rol]).join(' · ')}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardTitle>No participas de los talleres</CardTitle>
          <CardDescription>
            Declarar qué enseñas o qué quieres aprender, hacer match e inscribirte es de quien
            participa. Tu cuenta administra esa participación, así que son cosas separadas. Si
            quieres participar como una persona más, pídele a ENACTIVA una cuenta aparte.
          </CardDescription>
        </Card>

        {/*
         * Puede descargar sus datos pero no borrar su cuenta: si la única persona de RRHH se
         * elimina, su organización se queda sin quien la administre. Es el mismo motivo por el
         * que el Admin Principal tampoco puede (SPEC §3.7).
         */}
        <MisDatos puedeEliminar={false} />
      </div>
    </section>
  );
}

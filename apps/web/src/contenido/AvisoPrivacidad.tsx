import { AVISO_PRIVACIDAD_VERSION } from '@enactiva/shared';

/**
 * BORRADOR del equipo, pendiente de aprobación por ENACTIVA (SPEC Q3).
 * Al cambiar este texto hay que subir AVISO_PRIVACIDAD_VERSION en packages/shared,
 * para que quede registrado qué versión aceptó cada persona.
 */
export function AvisoPrivacidad() {
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-borde bg-fondo p-3 text-xs leading-relaxed text-texto-suave">
      <p className="mb-2 font-semibold text-peligro">
        Borrador: texto pendiente de aprobación por ENACTIVA.
      </p>
      <p className="mb-2">
        <strong>Qué datos se tratan.</strong> Tu nombre, tu correo, tu cargo y tu área, lo que
        declaras que puedes enseñar y que quieres aprender, y los talleres que dictas o a los que
        te inscribes.
      </p>
      <p className="mb-2">
        <strong>Para qué.</strong> Conectarte con quien puede enseñarte o aprender de ti, y
        convocar los talleres internos de tu organización.
      </p>
      <p className="mb-2">
        <strong>Quién los ve.</strong> El área de Recursos Humanos de tu organización puede ver tu
        participación, con tu nombre. ENACTIVA accede a la información para operar la plataforma.
        Tus datos no se comparten con otras empresas del piloto.
      </p>
      <p className="mb-2">
        <strong>Tus derechos.</strong> En «Mi perfil» puedes descargar todo lo que la plataforma
        guarda sobre ti y eliminar tu cuenta, sin pedírselo a nadie. Al eliminarla, los talleres
        que dictaste se conservan sin vincularse a tu identidad, porque otras personas
        participaron en ellos.
      </p>
      <p>
        <strong>Registro.</strong> Se guarda un registro de quién accede o modifica cada dato, según
        exige la Ley 21.719. Guarda la acción y los nombres de los campos, nunca tu nombre ni tu
        correo. Versión del aviso: {AVISO_PRIVACIDAD_VERSION}.
      </p>
    </div>
  );
}

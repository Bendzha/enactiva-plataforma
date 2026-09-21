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
        <strong>Qué datos se tratan.</strong> Tu nombre, tu correo, tu cargo y tu área, además de
        los cursos en que participas y los resultados de tus mediciones dentro de la plataforma.
      </p>
      <p className="mb-2">
        <strong>Para qué.</strong> Conectarte con quien puede enseñarte o aprender de ti, y medir la
        evolución de la capacitación interna de tu organización.
      </p>
      <p className="mb-2">
        <strong>Quién los ve.</strong> El área de Recursos Humanos de tu organización puede ver tus
        resultados individuales, con tu nombre. ENACTIVA accede a la información para operar la
        plataforma. Tus datos no se comparten con otras empresas del piloto.
      </p>
      <p className="mb-2">
        <strong>Tus derechos.</strong> Puedes pedir acceso a tus datos, corregirlos o solicitar su
        eliminación. Al eliminarlos, tus mediciones se conservan de forma anonimizada, sin
        vincularse a tu identidad.
      </p>
      <p>
        <strong>Registro.</strong> Se guarda un registro de quién accede o modifica cada dato, según
        exige la Ley 21.719. Versión del aviso: {AVISO_PRIVACIDAD_VERSION}.
      </p>
    </div>
  );
}

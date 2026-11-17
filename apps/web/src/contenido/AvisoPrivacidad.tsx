import { VERSIONES_LEGALES } from '@enactiva/shared';

/**
 * BORRADOR del equipo, pendiente de aprobación por ENACTIVA (SPEC Q3).
 * Al cambiar este texto hay que subir VERSIONES_LEGALES.AVISO_PRIVACIDAD en packages/shared,
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
        declaras que puedes enseñar y que quieres aprender, y los talleres que dictas o a los que te
        inscribes.
      </p>
      <p className="mb-2">
        <strong>Para qué.</strong> Conectarte con quien puede enseñarte o aprender de ti, y convocar
        los talleres internos de tu organización.
      </p>
      <p className="mb-2">
        <strong>Quién los ve.</strong> El área de Recursos Humanos de tu organización puede ver tu
        participación, con tu nombre. ENACTIVA accede a la información para operar la plataforma.
        Tus datos no se comparten con otras empresas del piloto.
      </p>
      <p className="mb-2">
        <strong>Lo que escribes sobre otras personas.</strong> Al terminar un taller puedes dejar
        una <strong>referencia</strong>: es texto libre, se ve dentro de tu organización y va
        firmada con tu nombre. Las estrellas con que valoras el taller sí son anónimas: quien dictó
        ve el promedio, nunca quién puso qué. Recursos Humanos puede ocultar una referencia dejando
        registrado el motivo.
      </p>
      <p className="mb-2">
        <strong>Los tokens.</strong> Se registra cuántos recibes por enseñar y por asistir, y de qué
        taller salió cada uno. El recuento es privado: lo ves tú, y Recursos Humanos ve el de su
        gente.
      </p>
      <p className="mb-2">
        <strong>Tus derechos.</strong> En «Mi perfil» puedes descargar todo lo que la plataforma
        guarda sobre ti y eliminar tu cuenta, sin pedírselo a nadie. Al eliminarla, los talleres que
        dictaste se conservan sin vincularse a tu identidad, porque otras personas participaron en
        ellos.
      </p>
      <p>
        <strong>Registro.</strong> Queda un registro de cada vez que alguien{' '}
        <strong>crea, modifica o elimina</strong> un dato, de los inicios de sesión y de cuándo
        alguien descarga o elimina sus propios datos. Guarda la acción y los nombres de los campos
        tocados, nunca su contenido, ni tu nombre ni tu correo.{' '}
        <strong>No se registra cada vez que alguien mira una pantalla</strong>: las consultas de
        Recursos Humanos a la información de su gente no dejan traza. Versión del aviso:{' '}
        {VERSIONES_LEGALES.AVISO_PRIVACIDAD}.
      </p>
    </div>
  );
}

import { VERSIONES_LEGALES } from '@enactiva/shared';

/**
 * BORRADOR del equipo, pendiente de revisión legal y de aprobación por ENACTIVA (SPEC Q3).
 *
 * Está escrito desde lo que la plataforma **realmente hace**, que es la parte que un abogado no
 * puede saber sin leer el código. El borrador largo, con lo que ENACTIVA tiene que completar,
 * está en `docs/legal/terminos-y-condiciones-borrador.md`.
 *
 * Al cambiar este texto hay que subir `VERSIONES_LEGALES.TERMINOS`: de eso depende que a quien
 * aceptó la versión anterior se le vuelva a pedir.
 */
export function Terminos() {
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-borde bg-fondo p-3 text-xs leading-relaxed text-texto-suave">
      <p className="mb-2 font-semibold text-peligro">
        Borrador: texto pendiente de revisión legal y de aprobación por ENACTIVA.
      </p>
      <p className="mb-2">
        <strong>Qué es esto.</strong> Una herramienta para que colegas de tu organización se enseñen
        entre ellos. No aloja clases ni material, no mide tu aprendizaje y no emite certificados: la
        actividad ocurre en persona, fuera de la plataforma.
      </p>
      <p className="mb-2">
        <strong>Tu cuenta.</strong> La crea tu organización y está asociada a tu correo de trabajo.
        Tu contraseña no se comparte. Al cambiarla se cierran tus demás sesiones.
      </p>
      <p className="mb-2">
        <strong>Los talleres.</strong> Inscribirte reserva un lugar real en una sala: si no vas a
        poder ir, cancela para liberarlo. Si dictas, te comprometes a aparecer y a pasar la lista de
        asistencia al terminar. Esa lista solo la ves tú, se cierra una vez y de ella salen los
        tokens.
      </p>
      <p className="mb-2">
        <strong>
          Las referencias son públicas dentro de tu organización y van firmadas con tu nombre.
        </strong>{' '}
        Las van a leer tus colegas y Recursos Humanos, y no se pueden borrar después. Escribe sobre
        el taller y lo que aprendiste, no sobre la persona. No se permite insultar, acosar,
        discriminar ni escribir datos personales de nadie. Las estrellas sí son anónimas: quien
        dictó ve el promedio. Recursos Humanos puede ocultar una referencia dejando registrado el
        motivo.
      </p>
      <p className="mb-2">
        <strong>Los tokens.</strong> Son un reconocimiento y la plataforma solo los cuenta. No son
        dinero ni un saldo: no se transfieren, no se compran y no se canjean aquí. Si valen algo, lo
        decide tu organización por fuera. Inventar asistencias para inflar el recuento es motivo de
        suspensión.
      </p>
      <p className="mb-2">
        <strong>Si no se cumplen estas reglas.</strong> Recursos Humanos puede ocultar una
        referencia y suspender el acceso de quien acose, falsee asistencias o infle su recuento.
        Antes de suspender a alguien se le dice por qué, y una suspensión no borra tus datos.
      </p>
      <p className="mb-2">
        <strong>Lo que no garantizamos.</strong> La plataforma está en versión piloto y puede tener
        interrupciones. Los recordatorios por correo son una ayuda, no el aviso oficial: tu agenda
        manda. Lo que un colega escriba en una referencia es suyo, no de ENACTIVA.
      </p>
      <p>
        <strong>Cambios.</strong> Si estos términos cambian de forma relevante se te va a pedir que
        los aceptes de nuevo al entrar. Versión: {VERSIONES_LEGALES.TERMINOS}.
      </p>
    </div>
  );
}

-- Dos documentos legales en vez de uno (SPEC §3.7, Q21).
--
-- El aviso de privacidad dice qué se hace con los datos y lo exige la Ley 21.719; los términos
-- dicen qué se puede hacer en la plataforma. Son dos aceptaciones con dos versiones: una sola
-- casilla para ambos haría imposible demostrar después qué aceptó cada persona.
--
-- Las filas que ya existen son aceptaciones del aviso, así que el DEFAULT las deja bien sin
-- tocarlas. La columna conserva su nombre `version_aviso` para no reescribir las existentes.

CREATE TYPE "DocumentoLegal" AS ENUM ('AVISO_PRIVACIDAD', 'TERMINOS');

ALTER TABLE "aceptacion_aviso"
    ADD COLUMN "documento" "DocumentoLegal" NOT NULL DEFAULT 'AVISO_PRIVACIDAD';

-- Aceptar dos veces el mismo documento en la misma versión no es un hecho nuevo.
CREATE UNIQUE INDEX "aceptacion_aviso_usuario_id_documento_version_aviso_key"
    ON "aceptacion_aviso"("usuario_id", "documento", "version_aviso");

-- Lista de asistencia y tokens por motivo (reunión con la clienta, 2026-10-29).
--
-- Quien dicta pasa lista cuando el taller termina, y de esa lista salen los tokens. Antes el
-- token era uno por taller y lo disparaba la primera valoración; esa regla la reemplazó la
-- clienta, así que la tabla se rehace en vez de remendarse.

-- Quien dicta la marca al pasar lista. NULL = todavía no se sabe, que no es lo mismo que "no fue".
ALTER TABLE "inscripcion" ADD COLUMN "asistio" BOOLEAN;

-- Cuándo se cerró la lista. Es lo que impide repartir los tokens dos veces.
ALTER TABLE "taller" ADD COLUMN "asistencia_cerrada_at" TIMESTAMPTZ(3);

-- Por qué alguien recibió tokens: las tres razones que fijó la clienta.
CREATE TYPE "MotivoToken" AS ENUM ('DICTAR_TALLER', 'ASISTENCIA_COMPLETA', 'ASISTIR');

-- Las filas que había las creó la regla anterior (una por taller, con la primera valoración).
-- Esa regla ya no existe, así que no hay nada que migrar: se van con la tabla.
DROP TABLE "token";

CREATE TABLE "token" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "motivo" "MotivoToken" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- Una fila por motivo y por persona: repetir el cierre no reparte de nuevo.
CREATE UNIQUE INDEX "token_taller_id_usuario_id_motivo_key" ON "token"("taller_id", "usuario_id", "motivo");

CREATE INDEX "token_empresa_id_usuario_id_idx" ON "token"("empresa_id", "usuario_id");

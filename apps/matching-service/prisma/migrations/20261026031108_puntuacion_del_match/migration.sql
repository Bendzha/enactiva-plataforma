-- CreateEnum
CREATE TYPE "PapelEnElMatch" AS ENUM ('ESTUDIANTE', 'CAPACITADOR');

-- CreateTable
CREATE TABLE "puntuacion_match" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "papel" "PapelEnElMatch" NOT NULL,
    "se_reunieron" BOOLEAN NOT NULL,
    "a_la_hora_acordada" BOOLEAN NOT NULL,
    "como_lo_esperaban" BOOLEAN NOT NULL,
    "repetirian" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puntuacion_match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puntuacion_match_empresa_id_match_id_idx" ON "puntuacion_match"("empresa_id", "match_id");

-- CreateIndex
CREATE INDEX "puntuacion_match_empresa_id_autor_id_idx" ON "puntuacion_match"("empresa_id", "autor_id");

-- CreateIndex
CREATE UNIQUE INDEX "puntuacion_match_match_id_autor_id_key" ON "puntuacion_match"("match_id", "autor_id");

-- AddForeignKey
ALTER TABLE "puntuacion_match" ADD CONSTRAINT "puntuacion_match_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

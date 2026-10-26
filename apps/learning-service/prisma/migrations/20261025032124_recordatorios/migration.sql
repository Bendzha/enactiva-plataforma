-- CreateEnum
CREATE TYPE "MomentoRecordatorio" AS ENUM ('VEINTICUATRO_HORAS', 'UNA_HORA');

-- CreateTable
CREATE TABLE "recordatorio_taller" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "momento" "MomentoRecordatorio" NOT NULL,
    "enviados" INTEGER NOT NULL,
    "enviado_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordatorio_taller_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recordatorio_taller_empresa_id_idx" ON "recordatorio_taller"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "recordatorio_taller_taller_id_momento_key" ON "recordatorio_taller"("taller_id", "momento");

-- AddForeignKey
ALTER TABLE "recordatorio_taller" ADD CONSTRAINT "recordatorio_taller_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

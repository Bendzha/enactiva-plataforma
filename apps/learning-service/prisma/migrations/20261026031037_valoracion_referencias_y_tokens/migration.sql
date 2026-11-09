-- CreateEnum
CREATE TYPE "DimensionValoracion" AS ENUM ('CLARIDAD', 'SEGURIDAD', 'APLICACION', 'USO_DE_MATERIALES');

-- CreateTable
CREATE TABLE "valoracion_taller" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "asistio" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valoracion_taller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrella_valoracion" (
    "valoracion_id" UUID NOT NULL,
    "dimension" "DimensionValoracion" NOT NULL,
    "estrellas" INTEGER NOT NULL,

    CONSTRAINT "estrella_valoracion_pkey" PRIMARY KEY ("valoracion_id","dimension")
);

-- CreateTable
CREATE TABLE "referencia" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "valoracion_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "capacitador_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "oculta_at" TIMESTAMPTZ(3),
    "oculta_por_id" UUID,
    "motivo_oculta" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "capacitador_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "valoracion_taller_empresa_id_taller_id_idx" ON "valoracion_taller"("empresa_id", "taller_id");

-- CreateIndex
CREATE INDEX "valoracion_taller_empresa_id_usuario_id_idx" ON "valoracion_taller"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "valoracion_taller_taller_id_usuario_id_key" ON "valoracion_taller"("taller_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "referencia_valoracion_id_key" ON "referencia"("valoracion_id");

-- CreateIndex
CREATE INDEX "referencia_empresa_id_capacitador_id_idx" ON "referencia"("empresa_id", "capacitador_id");

-- CreateIndex
CREATE INDEX "referencia_empresa_id_taller_id_idx" ON "referencia"("empresa_id", "taller_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_taller_id_key" ON "token"("taller_id");

-- CreateIndex
CREATE INDEX "token_empresa_id_capacitador_id_idx" ON "token"("empresa_id", "capacitador_id");

-- AddForeignKey
ALTER TABLE "valoracion_taller" ADD CONSTRAINT "valoracion_taller_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrella_valoracion" ADD CONSTRAINT "estrella_valoracion_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion_taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencia" ADD CONSTRAINT "referencia_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion_taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

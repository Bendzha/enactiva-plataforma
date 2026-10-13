-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('HABILIDAD', 'CONTENIDO', 'ACTITUD');

-- CreateEnum
CREATE TYPE "TipoInteres" AS ENUM ('ENSENAR', 'APRENDER');

-- CreateEnum
CREATE TYPE "NivelDominio" AS ENUM ('BASICO', 'INTERMEDIO', 'AVANZADO');

-- CreateTable
CREATE TABLE "tema" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "creado_por_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_interes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "tipo" "TipoInteres" NOT NULL,
    "dimensiones" "Dimension"[],
    "nivel" "NivelDominio" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "perfil_interes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_corporativo" (
    "usuario_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "intereses_generales" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "perfil_corporativo_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tema_empresa_id_nombre_normalizado_key" ON "tema"("empresa_id", "nombre_normalizado");

-- CreateIndex
CREATE INDEX "perfil_interes_empresa_id_tema_id_tipo_idx" ON "perfil_interes"("empresa_id", "tema_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_interes_usuario_id_tema_id_tipo_key" ON "perfil_interes"("usuario_id", "tema_id", "tipo");

-- CreateIndex
CREATE INDEX "perfil_corporativo_empresa_id_idx" ON "perfil_corporativo"("empresa_id");

-- AddForeignKey
ALTER TABLE "tema" ADD CONSTRAINT "tema_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tema" ADD CONSTRAINT "tema_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_interes" ADD CONSTRAINT "perfil_interes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_interes" ADD CONSTRAINT "perfil_interes_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "tema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_corporativo" ADD CONSTRAINT "perfil_corporativo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

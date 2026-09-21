-- CreateTable
CREATE TABLE "aceptacion_aviso" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "version_aviso" TEXT NOT NULL,
    "aceptado_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "aceptacion_aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aceptacion_aviso_usuario_id_idx" ON "aceptacion_aviso"("usuario_id");

-- AddForeignKey
ALTER TABLE "aceptacion_aviso" ADD CONSTRAINT "aceptacion_aviso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

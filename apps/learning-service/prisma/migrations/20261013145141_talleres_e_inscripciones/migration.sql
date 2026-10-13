-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('LOGIN', 'LOGIN_FALLIDO', 'LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'EXPORTAR', 'ANONIMIZAR');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateTable
CREATE TABLE "taller" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "capacitador_id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "resultados_esperados" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "inicio_at" TIMESTAMPTZ(3) NOT NULL,
    "fin_at" TIMESTAMPTZ(3) NOT NULL,
    "cupo" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "taller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripcion" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidad" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "actor_rol" "Rol",
    "empresa_id" UUID,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "campos_modificados" TEXT[],
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taller_empresa_id_inicio_at_idx" ON "taller"("empresa_id", "inicio_at");

-- CreateIndex
CREATE INDEX "taller_empresa_id_capacitador_id_idx" ON "taller"("empresa_id", "capacitador_id");

-- CreateIndex
CREATE INDEX "taller_empresa_id_tema_id_idx" ON "taller"("empresa_id", "tema_id");

-- CreateIndex
CREATE INDEX "inscripcion_empresa_id_usuario_id_idx" ON "inscripcion"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_taller_id_usuario_id_key" ON "inscripcion"("taller_id", "usuario_id");

-- CreateIndex
CREATE INDEX "disponibilidad_empresa_id_usuario_id_idx" ON "disponibilidad"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_usuario_id_dia_hora_inicio_hora_fin_key" ON "disponibilidad"("usuario_id", "dia", "hora_inicio", "hora_fin");

-- CreateIndex
CREATE INDEX "registro_auditoria_empresa_id_created_at_idx" ON "registro_auditoria"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "registro_auditoria_actor_id_created_at_idx" ON "registro_auditoria"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "taller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registro de auditoría append-only (ADR-0002, Ley 21.719): la base rechaza UPDATE y DELETE.
-- Es la misma protección que en identity_db; cada servicio la lleva en su propia base (ADR-0007).
CREATE FUNCTION "registro_auditoria_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registro_auditoria es append-only: operación % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registro_auditoria_sin_update_delete"
BEFORE UPDATE OR DELETE ON "registro_auditoria"
FOR EACH ROW EXECUTE FUNCTION "registro_auditoria_inmutable"();

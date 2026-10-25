-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('LOGIN', 'LOGIN_FALLIDO', 'LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'EXPORTAR', 'ANONIMIZAR');

-- CreateEnum
CREATE TYPE "DecisionMatch" AS ENUM ('INTERESADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "capacitador_id" UUID NOT NULL,
    "taller_id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "decision" "DecisionMatch" NOT NULL,
    "decidido_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "match_empresa_id_estudiante_id_idx" ON "match"("empresa_id", "estudiante_id");

-- CreateIndex
CREATE INDEX "match_empresa_id_taller_id_idx" ON "match"("empresa_id", "taller_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_estudiante_id_taller_id_key" ON "match"("estudiante_id", "taller_id");

-- CreateIndex
CREATE INDEX "registro_auditoria_empresa_id_created_at_idx" ON "registro_auditoria"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "registro_auditoria_actor_id_created_at_idx" ON "registro_auditoria"("actor_id", "created_at");

-- Registro de auditoría append-only (ADR-0002, Ley 21.719): la base rechaza UPDATE y DELETE.
-- Misma protección que en identity_db y learning_db; cada servicio la lleva en su base (ADR-0007).
CREATE FUNCTION "registro_auditoria_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registro_auditoria es append-only: operación % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registro_auditoria_sin_update_delete"
BEFORE UPDATE OR DELETE ON "registro_auditoria"
FOR EACH ROW EXECUTE FUNCTION "registro_auditoria_inmutable"();

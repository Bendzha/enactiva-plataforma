-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "NivelAdmin" AS ENUM ('PRINCIPAL', 'OPERATIVO');

-- CreateEnum
CREATE TYPE "EstadoEmpresa" AS ENUM ('ONBOARDING_PENDIENTE', 'ACTIVA');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('INVITADO', 'ACTIVO', 'SUSPENDIDO', 'ANONIMIZADO');

-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('REFRESH', 'INVITACION', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('LOGIN', 'LOGIN_FALLIDO', 'LEER', 'CREAR', 'ACTUALIZAR', 'ELIMINAR', 'EXPORTAR', 'ANONIMIZAR');

-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "estado" "EstadoEmpresa" NOT NULL DEFAULT 'ONBOARDING_PENDIENTE',
    "activada_at" TIMESTAMPTZ(3),
    "activada_por_id" UUID,
    "creada_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID,
    "email" TEXT,
    "password_hash" TEXT,
    "nombre" TEXT,
    "apellido" TEXT,
    "cargo" TEXT,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'INVITADO',
    "nivel_admin" "NivelAdmin",
    "anonimizado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" UUID NOT NULL,
    "rol" "Rol" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol")
);

-- CreateTable
CREATE TABLE "token_acceso" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoToken" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_at" TIMESTAMPTZ(3) NOT NULL,
    "usado_at" TIMESTAMPTZ(3),
    "revocado_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_acceso_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_empresa_id_idx" ON "usuario"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_acceso_token_hash_key" ON "token_acceso"("token_hash");

-- CreateIndex
CREATE INDEX "token_acceso_usuario_id_tipo_idx" ON "token_acceso"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "registro_auditoria_empresa_id_created_at_idx" ON "registro_auditoria"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "registro_auditoria_actor_id_created_at_idx" ON "registro_auditoria"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_activada_por_id_fkey" FOREIGN KEY ("activada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_acceso" ADD CONSTRAINT "token_acceso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registro de auditoría append-only (ADR-0002, Ley 21.719): la base rechaza UPDATE y DELETE.
CREATE FUNCTION "registro_auditoria_inmutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registro_auditoria es append-only: operación % no permitida', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registro_auditoria_sin_update_delete"
BEFORE UPDATE OR DELETE ON "registro_auditoria"
FOR EACH ROW EXECUTE FUNCTION "registro_auditoria_inmutable"();

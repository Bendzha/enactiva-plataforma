-- Solicitudes a RRHH (SPEC §2, reunión del 2026-10-29).
--
-- Escrita a mano porque los dos índices de abajo son **parciales** y Prisma no los modela.
-- Sin ellos, "una sola solicitud pendiente" sería una comprobación de aplicación, y dos clics
-- simultáneos la pasarían por el medio.

CREATE TYPE "TipoSolicitud" AS ENUM ('PROPUESTA_TALLER', 'CAMBIO_DE_ROL');
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

CREATE TABLE "solicitud" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "tema" TEXT,
    "tema_normalizado" TEXT,
    "detalle" TEXT NOT NULL DEFAULT '',
    "motivo_rechazo" TEXT,
    "resuelta_por_id" UUID,
    "resuelta_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitud_empresa_id_estado_idx" ON "solicitud"("empresa_id", "estado");
CREATE INDEX "solicitud_solicitante_id_idx" ON "solicitud"("solicitante_id");

ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_solicitante_id_fkey"
    FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_resuelta_por_id_fkey"
    FOREIGN KEY ("resuelta_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Una sola solicitud de rol pendiente por persona: o quiere enseñar o no, y pedirlo tres veces
-- no lo hace más cierto. Resuelta la anterior, puede volver a pedirlo.
CREATE UNIQUE INDEX "solicitud_un_cambio_de_rol_pendiente"
    ON "solicitud"("solicitante_id")
    WHERE "tipo" = 'CAMBIO_DE_ROL' AND "estado" = 'PENDIENTE';

-- La misma persona no propone dos veces el mismo tema mientras el primero sigue pendiente.
-- No se bloquea proponer **otro** tema: alguien puede tener dos ideas, y eso no es spam.
CREATE UNIQUE INDEX "solicitud_una_propuesta_por_tema_pendiente"
    ON "solicitud"("solicitante_id", "tema_normalizado")
    WHERE "tipo" = 'PROPUESTA_TALLER' AND "estado" = 'PENDIENTE';

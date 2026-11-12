-- Sacar un tema del catálogo sin borrarlo (SPEC §3.6).
--
-- RRHH administra el catálogo y pidió poder quitar temas. Borrarlos de verdad no sirve: de un
-- tema cuelgan las declaraciones de la gente, con borrado en cascada, y los talleres de
-- learning_db, que lo referencian sin clave foránea porque viven en otra base. Un DELETE se
-- llevaría los perfiles por delante en silencio y dejaría talleres apuntando a la nada.
--
-- Archivar lo saca de circulación: deja de ofrecerse y de poder elegirse, y lo que ya existe
-- sigue resolviendo su nombre.

ALTER TABLE "tema" ADD COLUMN "archivado_at" TIMESTAMPTZ(3);

-- El catálogo se consulta siempre por lo que sigue vigente.
CREATE INDEX "tema_empresa_id_archivado_at_idx" ON "tema"("empresa_id", "archivado_at");

-- Personalización del entorno de cada empresa (SPEC §3.8, ADR-0011).
--
-- Todo nullable: mientras una empresa no personalice, se usa la plantilla, y eso no es un estado
-- incompleto sino el normal. El logo va como data URI en una columna de texto; para un piloto de
-- 3-4 empresas con un logo cada una no vale la pena reabrir el almacenamiento de archivos que el
-- ADR-0008 eliminó.

ALTER TABLE "empresa" ADD COLUMN "color_marca" TEXT;
ALTER TABLE "empresa" ADD COLUMN "color_acento" TEXT;
ALTER TABLE "empresa" ADD COLUMN "color_fondo" TEXT;
ALTER TABLE "empresa" ADD COLUMN "color_texto" TEXT;
ALTER TABLE "empresa" ADD COLUMN "logo" TEXT;

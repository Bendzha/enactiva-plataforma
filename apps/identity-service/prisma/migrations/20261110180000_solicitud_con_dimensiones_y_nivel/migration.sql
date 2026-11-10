-- La propuesta de taller guarda lo mismo que pide declarar un interés.
--
-- Al aprobarla, RRHH crea el tema y la declaración de quien propuso queda hecha con las
-- dimensiones y el nivel que esa persona eligió. Sin estas columnas habría que inventarle un
-- nivel a alguien, que es exactamente lo que no se hace en este proyecto.

ALTER TABLE "solicitud" ADD COLUMN "tipo_interes" "TipoInteres";
ALTER TABLE "solicitud" ADD COLUMN "dimensiones" "Dimension"[] DEFAULT ARRAY[]::"Dimension"[];
ALTER TABLE "solicitud" ADD COLUMN "nivel" "NivelDominio";

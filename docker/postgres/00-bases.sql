-- Bases y roles de desarrollo local, una por microservicio (ADR-0007, decisión D3).
-- Postgres ejecuta este script SOLO cuando el directorio de datos está vacío:
-- si cambia, hay que recrear el volumen con `docker compose down -v`.
--
-- auth-service no aparece porque no tiene tablas propias: solo firma JWT.
-- Las credenciales son de desarrollo y coinciden con .env.example; nunca se usan fuera de local.

CREATE ROLE svc_identity LOGIN PASSWORD 'identity';
CREATE ROLE svc_learning LOGIN PASSWORD 'learning';
CREATE ROLE svc_matching LOGIN PASSWORD 'matching';

CREATE DATABASE identity_db OWNER svc_identity;
CREATE DATABASE learning_db OWNER svc_learning;
CREATE DATABASE matching_db OWNER svc_matching;

-- Aislamiento real entre servicios: aunque alguien equivoque el DATABASE_URL, el rol de un
-- servicio no puede conectarse a la base de otro. El superusuario `enactiva` sigue entrando a
-- todas para administrar y para psql.
REVOKE CONNECT ON DATABASE identity_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE learning_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE matching_db FROM PUBLIC;

GRANT CONNECT ON DATABASE identity_db TO svc_identity;
GRANT CONNECT ON DATABASE learning_db TO svc_learning;
GRANT CONNECT ON DATABASE matching_db TO svc_matching;

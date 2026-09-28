// Infraestructura común de los microservicios (ADR-0007).
// Aquí vive lo que NO puede divergir entre servicios: el guard, la regla de acotado por empresa,
// la caché de estado de sesión y la propagación del contexto entre servicios.
//
// No va en @enactiva/shared porque ese paquete lo importa el frontend, y esto depende de NestJS.

export { AuthGuard } from './auth.guard.js';
export { CABECERA_REQUEST_ID, TTL_ESTADO_SESION_MS } from './constantes.js';
export { ContextoModule } from './contexto.module.js';
export {
  cabecerasInternas,
  ClienteInterno,
  ErrorServicioInterno,
  type ContextoPeticion,
} from './contexto-interno.js';
export {
  CLAVE_PERMISOS,
  CLAVE_PUBLICO,
  CLAVE_SOLO_SESION,
  Publico,
  RequierePermiso,
  SoloSesion,
} from './decoradores.js';
export {
  cargarEnvRaiz,
  crearEnv,
  esquemaEnvBase,
  secretoJwtSchema,
  urlServicioSchema,
  type AccesoEnv,
} from './env.js';
export {
  CacheEstadoSesion,
  PROVEEDOR_ESTADO_SESION,
  ProveedorEstadoSesionNoDisponible,
  type EstadoSesion,
  type OpcionesCacheEstadoSesion,
  type ProveedorEstadoSesion,
} from './estado-sesion.js';
export { resolverRequestId } from './request-id.js';
export { SaludModule, type EstadoSalud } from './salud.module.js';
export {
  acotarArgs,
  type ArgsConsulta,
  type CampoEmpresa,
  type ModelosAcotados,
  type ParametrosAcotar,
} from './scope-empresa.js';
export {
  CLS_REQUEST_ID,
  CLS_SESION,
  CLS_TOKEN_ACCESO,
  Sesion,
  type RequestConSesion,
  type SesionActual,
} from './sesion.js';
export { ServiceKitModule, type OpcionesServiceKit } from './service-kit.module.js';
export { ZodValidationPipe } from './zod.pipe.js';

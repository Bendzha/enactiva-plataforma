import type { NivelAdmin, Rol } from './enums.js';

/** Datos de la persona autenticada que la API devuelve al iniciar sesión. */
export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  roles: Rol[];
  /** Solo para el equipo ENACTIVA: PRINCIPAL u OPERATIVO. */
  nivelAdmin: NivelAdmin | null;
  /** Null para el equipo ENACTIVA; la empresa a la que pertenece en el resto de los casos. */
  empresaId: string | null;
}

export interface RespuestaLogin {
  /** Token de vida corta; el refresh viaja aparte, en una cookie httpOnly. */
  accessToken: string;
  usuario: UsuarioSesion;
}

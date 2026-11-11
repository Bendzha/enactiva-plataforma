import {
  permisosDe,
  type AceptarInvitacionInput,
  type Permiso,
  type RespuestaLogin,
  type UsuarioSesion,
} from '@enactiva/shared';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { guardarToken, pedir, renovarSesion } from '@/lib/api';

interface ContextoSesion {
  usuario: UsuarioSesion | null;
  cargando: boolean;
  puede: (permiso: Permiso) => boolean;
  iniciarSesion: (email: string, password: string) => Promise<UsuarioSesion>;
  activarCuenta: (datos: AceptarInvitacionInput) => Promise<UsuarioSesion>;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al abrir o recargar la página se intenta recuperar la sesión con la cookie de refresh.
  useEffect(() => {
    let vigente = true;
    renovarSesion()
      .then((recuperado) => {
        if (vigente) setUsuario((recuperado as UsuarioSesion | null) ?? null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const datos = await pedir<RespuestaLogin>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    guardarToken(datos.accessToken);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  /** Activar una invitación deja la sesión iniciada: no hay que volver a escribir la contraseña. */
  const activarCuenta = useCallback(async (entrada: AceptarInvitacionInput) => {
    const datos = await pedir<RespuestaLogin>('/auth/invitaciones/aceptar', {
      method: 'POST',
      body: JSON.stringify(entrada),
    });
    guardarToken(datos.accessToken);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await pedir<void>('/auth/logout', { method: 'POST' });
    } finally {
      guardarToken(null);
      setUsuario(null);
      // Se vacía todo lo cacheado: en un equipo compartido —un turno de planta, por ejemplo— la
      // siguiente persona no tiene por qué ver ni un resto de la anterior. Apareció con los
      // colores de la empresa, que sobrevivían al cambio de sesión.
      queryClient.clear();
    }
  }, [queryClient]);

  const valor = useMemo<ContextoSesion>(() => {
    const permisos = usuario ? permisosDe(usuario.roles, usuario.nivelAdmin) : new Set<Permiso>();
    return {
      usuario,
      cargando,
      puede: (permiso: Permiso) => permisos.has(permiso),
      iniciarSesion,
      activarCuenta,
      cerrarSesion,
    };
  }, [usuario, cargando, iniciarSesion, activarCuenta, cerrarSesion]);

  return <Contexto value={valor}>{children}</Contexto>;
}

export function useSesion(): ContextoSesion {
  const contexto = use(Contexto);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  }
  return contexto;
}

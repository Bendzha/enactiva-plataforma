import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AceptarInvitacionInput,
  LoginInput,
  RespuestaLogin,
  SesionEstablecida,
  UsuarioSesion,
} from '@enactiva/shared';
import { IdentityCliente } from '../../identity.cliente.js';
import { ACCESS_TOKEN_TTL } from './auth.constantes.js';

export interface SesionEmitida {
  respuesta: RespuestaLogin;
  refreshToken: string;
  refreshExpiraAt: Date;
}

/**
 * auth-service: el único que firma tokens (ADR-0007).
 *
 * No tiene base de datos. Todo lo que toca credenciales, tokens de refresh y datos de la persona
 * ocurre en identity-service; aquí solo se firma el access token y se maneja la cookie.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly identity: IdentityCliente,
  ) {}

  async login(datos: LoginInput, ip?: string | null): Promise<SesionEmitida> {
    return this.firmar(await this.identity.login({ ...datos, ip: ip ?? null }));
  }

  async refrescar(refreshToken: string | undefined, ip?: string | null): Promise<SesionEmitida> {
    // Sin cookie no hay nada que rotar. Se responde aquí y no se llama a identity: mandar una
    // cadena vacía daría un 400 por validación, cuando lo correcto es 401, que es lo que la web
    // interpreta como "no hay sesión" al cargar la página.
    if (!refreshToken) {
      throw new UnauthorizedException('Sesión no válida');
    }

    return this.firmar(await this.identity.refrescar({ token: refreshToken, ip: ip ?? null }));
  }

  async cerrarSesion(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.identity.cerrar(refreshToken);
  }

  async aceptarInvitacion(
    datos: AceptarInvitacionInput,
    ip?: string | null,
  ): Promise<SesionEmitida> {
    return this.firmar(await this.identity.aceptarInvitacion({ ...datos, ip: ip ?? null }));
  }

  /** Perfil de la sesión actual, leído de identity: la web lo usa al recargar la página. */
  perfil(): Promise<UsuarioSesion> {
    return this.identity.perfil<UsuarioSesion>();
  }

  /**
   * El JWT lleva solo lo justo para identificar la petición. Los roles y la empresa que van
   * dentro son informativos: cada servicio vuelve a consultarlos, porque el token pudo firmarse
   * antes de que cambiaran (ADR-0007, decisión D2).
   */
  private async firmar(sesion: SesionEstablecida): Promise<SesionEmitida> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: sesion.usuario.id,
        roles: sesion.usuario.roles,
        nivelAdmin: sesion.usuario.nivelAdmin,
        empresaId: sesion.usuario.empresaId,
      },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    return {
      respuesta: { accessToken, usuario: sesion.usuario },
      refreshToken: sesion.refreshToken,
      refreshExpiraAt: new Date(sesion.refreshExpiraAt),
    };
  }
}

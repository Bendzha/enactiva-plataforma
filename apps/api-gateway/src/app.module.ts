import { Module } from '@nestjs/common';
import { ContextoModule, SaludModule } from '@enactiva/service-kit';

/**
 * api-gateway (ADR-0007): único punto de entrada del frontend.
 *
 * Importa `ContextoModule` y no `ServiceKitModule` a propósito: el gateway genera el
 * `X-Request-Id` que después siguen todos los servicios, pero **no valida el JWT** ni monta el
 * guard. Cada servicio verifica su propio token, para que ninguna petición dependa de que
 * auth-service esté arriba.
 *
 * Fase M0: solo responde `/health`. El enrutamiento por prefijo (`/auth/*`, `/identity/*`,
 * `/learning/*`, `/matching/*`) llega en M2.
 */
@Module({
  imports: [ContextoModule.forRoot(), SaludModule.paraServicio('api-gateway')],
})
export class AppModule {}

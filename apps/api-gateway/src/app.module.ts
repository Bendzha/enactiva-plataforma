import { Module } from '@nestjs/common';
import { ContextoModule, SaludModule } from '@enactiva/service-kit';
import { DatosPersonalesController } from './datos-personales.js';

/**
 * api-gateway (ADR-0007): único punto de entrada del frontend.
 *
 * Importa `ContextoModule` y no `ServiceKitModule` a propósito: el gateway genera el
 * `X-Request-Id` que después siguen todos los servicios, pero **no valida el JWT** ni monta el
 * guard. Cada servicio verifica su propio token, para que ninguna petición dependa de que
 * auth-service esté arriba.
 *
 * Enruta por prefijo (`/auth/*`, `/identity/*`, `/learning/*`, `/matching/*`) y compone una sola
 * cosa: la exportación y la supresión de datos de una persona, que viven repartidas en tres
 * bases y no se pueden resolver en un solo servicio (Ley 21.719).
 */
@Module({
  imports: [ContextoModule.forRoot(), SaludModule.paraServicio('api-gateway')],
  controllers: [DatosPersonalesController],
})
export class AppModule {}

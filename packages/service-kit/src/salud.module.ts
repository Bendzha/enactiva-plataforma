import { Controller, type DynamicModule, Get, Inject, Injectable, Module } from '@nestjs/common';
import { Publico } from './decoradores.js';

export interface EstadoSalud {
  status: 'ok';
  /** Qué proceso respondió: con cinco servicios hay que saber a cuál se le preguntó. */
  servicio: string;
  timestamp: string;
}

const NOMBRE_SERVICIO = 'NOMBRE_SERVICIO';

@Injectable()
export class SaludService {
  constructor(@Inject(NOMBRE_SERVICIO) private readonly servicio: string) {}

  check(): EstadoSalud {
    return { status: 'ok', servicio: this.servicio, timestamp: new Date().toISOString() };
  }
}

@Controller('health')
export class SaludController {
  // Inyección por tipo: el e2e falla si el runner de tests no emite metadata de decoradores.
  constructor(private readonly salud: SaludService) {}

  @Get()
  @Publico()
  check(): EstadoSalud {
    return this.salud.check();
  }
}

/** `GET /health` para cualquiera de los servicios: `SaludModule.paraServicio('identity-service')`. */
@Module({})
export class SaludModule {
  static paraServicio(nombre: string): DynamicModule {
    return {
      module: SaludModule,
      controllers: [SaludController],
      providers: [SaludService, { provide: NOMBRE_SERVICIO, useValue: nombre }],
    };
  }
}

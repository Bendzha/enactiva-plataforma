import { Controller, Get } from '@nestjs/common';
import type { MetricasGlobales, MetricasIntereses } from '@enactiva/shared';
import { RequierePermiso, Sesion, type SesionActual } from '@enactiva/service-kit';
import { MetricasService } from './metricas.service.js';

@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  /** RRHH, sobre su propia empresa. */
  @Get('intereses')
  @RequierePermiso('personas:gestionar')
  intereses(@Sesion() sesion: SesionActual): Promise<MetricasIntereses> {
    return this.metricas.intereses(sesion);
  }

  /** Admin Principal, sobre el piloto completo. */
  @Get('globales')
  @RequierePermiso('metricas-globales:ver')
  globales(): Promise<MetricasGlobales> {
    return this.metricas.globales();
  }
}

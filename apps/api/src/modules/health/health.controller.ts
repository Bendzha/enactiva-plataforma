import { Controller, Get } from '@nestjs/common';
import { HealthService, type EstadoSalud } from './health.service.js';

@Controller('health')
export class HealthController {
  // Inyección por tipo: el e2e falla si el runner de tests no emite metadata de decoradores.
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): EstadoSalud {
    return this.health.check();
  }
}

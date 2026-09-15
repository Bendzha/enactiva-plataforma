import { Injectable } from '@nestjs/common';

export interface EstadoSalud {
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class HealthService {
  check(): EstadoSalud {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

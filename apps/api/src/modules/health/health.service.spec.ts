import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reporta estado ok con un timestamp ISO válido', () => {
    const estado = new HealthService().check();

    expect(estado.status).toBe('ok');
    expect(new Date(estado.timestamp).toISOString()).toBe(estado.timestamp);
  });
});

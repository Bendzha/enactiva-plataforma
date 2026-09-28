import { Controller, Get, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CABECERA_REQUEST_ID } from './constantes.js';
import { Publico, RequierePermiso, SoloSesion } from './decoradores.js';
import {
  PROVEEDOR_ESTADO_SESION,
  type EstadoSesion,
  type ProveedorEstadoSesion,
} from './estado-sesion.js';
import { ServiceKitModule } from './service-kit.module.js';
import { Sesion, type SesionActual } from './sesion.js';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';

class ProveedorFalso implements ProveedorEstadoSesion {
  llamadas = 0;
  readonly estados = new Map<string, EstadoSesion>();

  cargar(usuarioId: string): Promise<EstadoSesion | null> {
    this.llamadas += 1;
    return Promise.resolve(this.estados.get(usuarioId) ?? null);
  }
}

@Controller()
class RutasDePrueba {
  @Get('abierta')
  @Publico()
  abierta() {
    return { ok: true };
  }

  @Get('mi-sesion')
  @SoloSesion()
  miSesion(@Sesion() sesion: SesionActual) {
    return { usuarioId: sesion.usuarioId, empresaId: sesion.empresaId };
  }

  @Get('empresas')
  @RequierePermiso('empresas:listar')
  empresas() {
    return { ok: true };
  }

  @Get('olvidada')
  olvidada() {
    return { ok: true };
  }
}

describe('guard global de los servicios', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let proveedor: ProveedorFalso;

  beforeEach(async () => {
    proveedor = new ProveedorFalso();
    proveedor.estados.set('rrhh-1', {
      usuarioId: 'rrhh-1',
      roles: ['RRHH'],
      nivelAdmin: null,
      empresaId: 'empresa-1',
      activo: true,
    });
    proveedor.estados.set('admin-1', {
      usuarioId: 'admin-1',
      roles: ['ADMIN_ENACTIVA'],
      nivelAdmin: 'PRINCIPAL',
      empresaId: null,
      activo: true,
    });
    proveedor.estados.set('desactivado-1', {
      usuarioId: 'desactivado-1',
      roles: ['RRHH'],
      nivelAdmin: null,
      empresaId: 'empresa-1',
      activo: false,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ServiceKitModule.forRoot({
          secretoJwt: SECRETO,
          proveedorEstadoSesion: { provide: PROVEEDOR_ESTADO_SESION, useValue: proveedor },
        }),
      ],
      controllers: [RutasDePrueba],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const token = (sub: string) => jwt.sign({ sub });

  it('deja pasar una ruta pública sin token', async () => {
    await request(app.getHttpServer()).get('/abierta').expect(200);
  });

  it('sin token responde 401', async () => {
    await request(app.getHttpServer()).get('/mi-sesion').expect(401);
  });

  it('con un token firmado con otro secreto responde 401', async () => {
    const ajeno = new JwtService({ secret: 'otro-secreto-igual-de-largo-para-firmar' });

    await request(app.getHttpServer())
      .get('/mi-sesion')
      .set('Authorization', `Bearer ${ajeno.sign({ sub: 'rrhh-1' })}`)
      .expect(401);
  });

  it('con sesión válida entrega los datos leídos del estado, no del token', async () => {
    const res = await request(app.getHttpServer())
      .get('/mi-sesion')
      .set('Authorization', `Bearer ${token('rrhh-1')}`)
      .expect(200);

    expect(res.body).toEqual({ usuarioId: 'rrhh-1', empresaId: 'empresa-1' });
  });

  it('un token válido de alguien que ya no existe responde 401', async () => {
    await request(app.getHttpServer())
      .get('/mi-sesion')
      .set('Authorization', `Bearer ${token('fantasma')}`)
      .expect(401);
  });

  it('un token válido de una cuenta desactivada responde 401', async () => {
    // Es el hoyo que cerramos en T2.4: el token sigue siendo válido, la cuenta no.
    await request(app.getHttpServer())
      .get('/mi-sesion')
      .set('Authorization', `Bearer ${token('desactivado-1')}`)
      .expect(401);
  });

  it('sin el permiso exigido responde 403', async () => {
    await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${token('rrhh-1')}`)
      .expect(403);
  });

  it('con el permiso exigido responde 200', async () => {
    await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${token('admin-1')}`)
      .expect(200);
  });

  it('una ruta que no declara permisos se rechaza en vez de quedar abierta', async () => {
    await request(app.getHttpServer())
      .get('/olvidada')
      .set('Authorization', `Bearer ${token('admin-1')}`)
      .expect(403);
  });

  it('dos peticiones seguidas consultan el estado una sola vez', async () => {
    const autorizacion = `Bearer ${token('rrhh-1')}`;
    await request(app.getHttpServer()).get('/mi-sesion').set('Authorization', autorizacion);
    await request(app.getHttpServer()).get('/mi-sesion').set('Authorization', autorizacion);

    expect(proveedor.llamadas).toBe(1);
  });

  it('devuelve un id de petición y reutiliza el que le manden', async () => {
    const generado = await request(app.getHttpServer()).get('/abierta').expect(200);
    expect(generado.headers[CABECERA_REQUEST_ID]).toMatch(/^[0-9a-f-]{36}$/);

    const propagado = await request(app.getHttpServer())
      .get('/abierta')
      .set(CABECERA_REQUEST_ID, 'req-de-prueba');
    expect(propagado.headers[CABECERA_REQUEST_ID]).toBe('req-de-prueba');
  });
});

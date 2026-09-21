import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Publico, RequierePermiso, SoloSesion } from '../src/common/decoradores.js';
import { hashPassword } from '../src/common/password.js';
import { Sesion, type SesionActual } from '../src/common/sesion.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Controlador de prueba: cubre las cuatro formas en que una ruta puede declararse (o no declararse).
@Controller('prueba-permisos')
class PruebaPermisosController {
  @Get('publica')
  @Publico()
  publica() {
    return { ok: true };
  }

  @Get('sesion')
  @SoloSesion()
  sesion(@Sesion() sesion: SesionActual) {
    return { usuarioId: sesion.usuarioId, empresaId: sesion.empresaId, roles: sesion.roles };
  }

  @Get('metricas')
  @RequierePermiso('metricas-globales:ver')
  metricas() {
    return { ok: true };
  }

  @Get('crear-empresa')
  @RequierePermiso('empresas:crear')
  crearEmpresa() {
    return { ok: true };
  }

  @Get('sin-declarar')
  sinDeclarar() {
    return { ok: true };
  }
}

@Module({ controllers: [PruebaPermisosController] })
class PruebaPermisosModule {}

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const EMAIL_OPERATIVO = 'operativo.e2e@plataforma.local';
const EMAIL_RRHH = 'rrhh.e2e@plataforma.local';
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const NOMBRE_EMPRESA = 'Empresa de prueba e2e';

describe('Permisos y guard global (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenPrincipal: string;
  let tokenOperativo: string;
  let tokenRrhh: string;
  let empresaId: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, PruebaPermisosModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const passwordHash = await hashPassword(PASSWORD_PRUEBA);

    const empresa = await prisma.empresa.create({
      data: { nombre: NOMBRE_EMPRESA, rubro: 'Pruebas', creadaPorId: admin.id },
    });
    empresaId = empresa.id;

    await prisma.usuario.create({
      data: {
        email: EMAIL_OPERATIVO,
        passwordHash,
        estado: 'ACTIVO',
        nivelAdmin: 'OPERATIVO',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });

    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH,
        passwordHash,
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'RRHH' } },
      },
    });

    tokenPrincipal = await iniciarSesion(EMAIL_ADMIN, PASSWORD_ADMIN);
    tokenOperativo = await iniciarSesion(EMAIL_OPERATIVO, PASSWORD_PRUEBA);
    tokenRrhh = await iniciarSesion(EMAIL_RRHH, PASSWORD_PRUEBA);
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: [EMAIL_OPERATIVO, EMAIL_RRHH] } } });
    await prisma.empresa.deleteMany({ where: { id: empresaId } });
    await app.close();
  });

  it('una ruta pública se puede usar sin iniciar sesión', async () => {
    await request(app.getHttpServer()).get('/prueba-permisos/publica').expect(200);
  });

  it('sin token responde 401', async () => {
    await request(app.getHttpServer()).get('/prueba-permisos/sesion').expect(401);
  });

  it('con un token inventado responde 401', async () => {
    await request(app.getHttpServer())
      .get('/prueba-permisos/sesion')
      .set('Authorization', 'Bearer token.falso.inventado')
      .expect(401);
  });

  it('con sesión iniciada entrega los datos de la persona autenticada', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-permisos/sesion')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    expect(res.body.empresaId).toBe(empresaId);
    expect(res.body.roles).toEqual(['RRHH']);
  });

  it('el Admin Principal puede ver métricas globales', async () => {
    await request(app.getHttpServer())
      .get('/prueba-permisos/metricas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);
  });

  it('el Admin Operativo NO puede ver métricas globales', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-permisos/metricas')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(403);

    expect(res.body.message).toMatch(/permiso/i);
  });

  it('el Admin Operativo sí puede crear empresas', async () => {
    await request(app.getHttpServer())
      .get('/prueba-permisos/crear-empresa')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(200);
  });

  it('RRHH no tiene permisos de administración de ENACTIVA', async () => {
    await request(app.getHttpServer())
      .get('/prueba-permisos/crear-empresa')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(403);
  });

  it('una ruta que no declara permisos se rechaza aunque la sesión sea válida', async () => {
    await request(app.getHttpServer())
      .get('/prueba-permisos/sin-declarar')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(403);
  });

  it('GET /auth/yo devuelve el perfil de la sesión y exige token', async () => {
    await request(app.getHttpServer()).get('/auth/yo').expect(401);

    const res = await request(app.getHttpServer())
      .get('/auth/yo')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    expect(res.body).toMatchObject({ email: EMAIL_ADMIN, nivelAdmin: 'PRINCIPAL' });
    expect(res.body.roles).toContain('ADMIN_ENACTIVA');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

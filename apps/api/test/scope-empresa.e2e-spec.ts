import { Controller, Get, Module, Param, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { SoloSesion } from '../src/common/decoradores.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Controlador de prueba que consulta SIEMPRE con el cliente acotado.
@Controller('prueba-scope')
class PruebaScopeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('usuarios')
  @SoloSesion()
  usuarios() {
    return this.prisma.acotado.usuario.findMany({ select: { email: true, empresaId: true } });
  }

  @Get('usuarios/contar')
  @SoloSesion()
  async contar() {
    return { total: await this.prisma.acotado.usuario.count() };
  }

  @Get('empresas')
  @SoloSesion()
  empresas() {
    return this.prisma.acotado.empresa.findMany({ select: { id: true, nombre: true } });
  }

  @Get('empresas/:id')
  @SoloSesion()
  async empresa(@Param('id') id: string) {
    return { empresa: await this.prisma.acotado.empresa.findUnique({ where: { id } }) };
  }

  @Get('renombrar-cargo/:id')
  @SoloSesion()
  async renombrarCargo(@Param('id') id: string) {
    const resultado = await this.prisma.acotado.usuario.updateMany({
      where: { id },
      data: { cargo: 'modificado-por-otra-empresa' },
    });
    return { modificados: resultado.count };
  }
}

@Module({ controllers: [PruebaScopeController] })
class PruebaScopeModule {}

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_RRHH_A = 'rrhh.a.scope@plataforma.local';
const EMAIL_RRHH_B = 'rrhh.b.scope@plataforma.local';
const EMAIL_ESTUDIANTE_B = 'estudiante.b.scope@plataforma.local';
const EMAILS_PRUEBA = [EMAIL_RRHH_A, EMAIL_RRHH_B, EMAIL_ESTUDIANTE_B];

describe('Aislamiento de datos entre empresas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let empresaAId: string;
  let empresaBId: string;
  let estudianteBId: string;
  let tokenRrhhA: string;
  let tokenAdmin: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, PruebaScopeModule],
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

    const empresaA = await prisma.empresa.create({
      data: { nombre: 'Empresa A (scope)', rubro: 'Pruebas', creadaPorId: admin.id },
    });
    const empresaB = await prisma.empresa.create({
      data: { nombre: 'Empresa B (scope)', rubro: 'Pruebas', creadaPorId: admin.id },
    });
    empresaAId = empresaA.id;
    empresaBId = empresaB.id;

    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH_A,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaAId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH_B,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaBId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    const estudianteB = await prisma.usuario.create({
      data: {
        email: EMAIL_ESTUDIANTE_B,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaBId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    estudianteBId = estudianteB.id;

    tokenRrhhA = await iniciarSesion(EMAIL_RRHH_A, PASSWORD_PRUEBA);
    tokenAdmin = await iniciarSesion(EMAIL_ADMIN, PASSWORD_ADMIN);
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: EMAILS_PRUEBA } } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaAId, empresaBId] } } });
    await app.close();
  });

  it('RRHH de la empresa A solo ve personas de su empresa', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-scope/usuarios')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    const emails = res.body.map((u: { email: string }) => u.email);
    expect(emails).toContain(EMAIL_RRHH_A);
    expect(emails).not.toContain(EMAIL_RRHH_B);
    expect(emails).not.toContain(EMAIL_ESTUDIANTE_B);
    // Tampoco ve al equipo ENACTIVA, que no pertenece a ninguna empresa.
    expect(emails).not.toContain(EMAIL_ADMIN);
    expect(res.body.every((u: { empresaId: string }) => u.empresaId === empresaAId)).toBe(true);
  });

  it('los conteos también quedan acotados a su empresa', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-scope/usuarios/contar')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    const enBase = await prisma.usuario.count({ where: { empresaId: empresaAId } });
    expect(res.body.total).toBe(enBase);
  });

  it('RRHH de A solo ve su propia empresa en el listado', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-scope/empresas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    expect(res.body.map((e: { id: string }) => e.id)).toEqual([empresaAId]);
  });

  it('pedir la empresa B por su id devuelve vacío, no un error que confirme que existe', async () => {
    const res = await request(app.getHttpServer())
      .get(`/prueba-scope/empresas/${empresaBId}`)
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    expect(res.body.empresa).toBeNull();
  });

  it('no puede modificar a una persona de otra empresa', async () => {
    const res = await request(app.getHttpServer())
      .get(`/prueba-scope/renombrar-cargo/${estudianteBId}`)
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    expect(res.body.modificados).toBe(0);

    const sinTocar = await prisma.usuario.findUniqueOrThrow({ where: { id: estudianteBId } });
    expect(sinTocar.cargo).toBeNull();
  });

  it('el equipo ENACTIVA sí ve todas las empresas del piloto', async () => {
    const res = await request(app.getHttpServer())
      .get('/prueba-scope/empresas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const ids = res.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(empresaAId);
    expect(ids).toContain(empresaBId);
  });

  it('fuera de una petición, el cliente acotado falla en vez de devolver datos de todos', async () => {
    await expect(prisma.acotado.usuario.findMany()).rejects.toThrow(/sin sesión en contexto/i);
  });
});

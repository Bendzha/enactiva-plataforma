/**
 * Datos de la demo del 2026-10-23, en un solo lugar.
 *
 * Los identificadores son **fijos a propósito**. Dos razones:
 *
 * 1. El seed puede correrse mil veces y deja exactamente lo mismo, porque todo entra por
 *    `upsert` contra un id conocido.
 * 2. learning_db puede colgar un taller de un tema de identity_db sin consultarla. Ningún
 *    servicio toca la base de otro (ADR-0007), y el seed no va a ser la excepción que rompa
 *    esa regla.
 *
 * Las contraseñas no están aquí: salen de DEMO_PASSWORD, y el valor concreto vive solo en
 * `docs/DEMO.md`. Este repositorio es público.
 */

export const EMPRESAS = {
  plantaNorte: {
    id: '01993000-0000-7000-8000-000000000001',
    nombre: 'Planta Norte (demo)',
    rubro: 'Minería',
  },
  comercialLin: {
    id: '01993000-0000-7000-8000-000000000002',
    nombre: 'Comercial Lin (demo)',
    rubro: 'Retail',
  },
} as const;

export const AREAS = {
  operaciones: {
    id: '01993000-0001-7000-8000-000000000001',
    empresaId: EMPRESAS.plantaNorte.id,
    nombre: 'Operaciones',
  },
  mantencion: {
    id: '01993000-0001-7000-8000-000000000002',
    empresaId: EMPRESAS.plantaNorte.id,
    nombre: 'Mantención',
  },
  personas: {
    id: '01993000-0001-7000-8000-000000000003',
    empresaId: EMPRESAS.plantaNorte.id,
    nombre: 'Personas',
  },
  sala: {
    id: '01993000-0001-7000-8000-000000000004',
    empresaId: EMPRESAS.comercialLin.id,
    nombre: 'Sala de ventas',
  },
} as const;

export interface UsuarioDemo {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  cargo: string | null;
  empresaId: string | null;
  areaId: string | null;
  roles: readonly ('ADMIN_ENACTIVA' | 'RRHH' | 'CAPACITADOR' | 'ESTUDIANTE')[];
  nivelAdmin: 'PRINCIPAL' | 'OPERATIVO' | null;
  /**
   * El papel que esta cuenta representa en la demo, o null si es relleno para que las métricas
   * y los cupos no muestren siempre "1 de 1". Las que tienen papel salen en docs/DEMO.md.
   *
   * Hace falta además del rol: el facilitador también es ESTUDIANTE, así que buscar por rol
   * devolvería la cuenta equivocada.
   */
  papel: 'adminPrincipal' | 'adminOperativo' | 'rrhh' | 'facilitador' | 'participante' | null;
}

const U = '01993000-0002-7000-8000-0000000000';

export const USUARIOS: readonly UsuarioDemo[] = [
  {
    id: `${U}01`,
    email: 'admin.principal@demo.enactiva.local',
    nombre: 'Paula',
    apellido: 'Riquelme',
    cargo: 'Dirección',
    empresaId: null,
    areaId: null,
    roles: ['ADMIN_ENACTIVA'],
    nivelAdmin: 'PRINCIPAL',
    papel: 'adminPrincipal',
  },
  {
    id: `${U}02`,
    email: 'admin.operativo@demo.enactiva.local',
    nombre: 'Tomás',
    apellido: 'Aguilera',
    cargo: 'Operaciones ENACTIVA',
    empresaId: null,
    areaId: null,
    roles: ['ADMIN_ENACTIVA'],
    nivelAdmin: 'OPERATIVO',
    papel: 'adminOperativo',
  },
  {
    id: `${U}03`,
    email: 'rrhh@demo.plantanorte.local',
    nombre: 'Marcela',
    apellido: 'Ruiz',
    cargo: 'Jefa de Personas',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.personas.id,
    roles: ['RRHH'],
    nivelAdmin: null,
    papel: 'rrhh',
  },
  {
    id: `${U}04`,
    email: 'facilitador@demo.plantanorte.local',
    nombre: 'Luis',
    apellido: 'Soto',
    cargo: 'Supervisor de turno',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.operaciones.id,
    roles: ['CAPACITADOR', 'ESTUDIANTE'],
    nivelAdmin: null,
    papel: 'facilitador',
  },
  {
    id: `${U}05`,
    email: 'participante@demo.plantanorte.local',
    nombre: 'Ana',
    apellido: 'Vera',
    cargo: 'Analista de procesos',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.operaciones.id,
    roles: ['ESTUDIANTE'],
    nivelAdmin: null,
    papel: 'participante',
  },
  // Gente de relleno: sin ellos las métricas y los cupos mostrarían siempre 1 de 1.
  {
    id: `${U}06`,
    email: 'carla.munoz@demo.plantanorte.local',
    nombre: 'Carla',
    apellido: 'Muñoz',
    cargo: 'Mantención eléctrica',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.mantencion.id,
    roles: ['ESTUDIANTE', 'CAPACITADOR'],
    nivelAdmin: null,
    papel: null,
  },
  {
    id: `${U}07`,
    email: 'diego.paredes@demo.plantanorte.local',
    nombre: 'Diego',
    apellido: 'Paredes',
    cargo: 'Operador',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.operaciones.id,
    roles: ['ESTUDIANTE'],
    nivelAdmin: null,
    papel: null,
  },
  {
    id: `${U}08`,
    email: 'sofia.leiva@demo.plantanorte.local',
    nombre: 'Sofía',
    apellido: 'Leiva',
    cargo: 'Prevencionista',
    empresaId: EMPRESAS.plantaNorte.id,
    areaId: AREAS.mantencion.id,
    roles: ['ESTUDIANTE'],
    nivelAdmin: null,
    papel: null,
  },
  {
    id: `${U}09`,
    email: 'rrhh@demo.comerciallin.local',
    nombre: 'Rodrigo',
    apellido: 'Fuentes',
    cargo: 'Jefe de Personas',
    empresaId: EMPRESAS.comercialLin.id,
    areaId: AREAS.sala.id,
    roles: ['RRHH'],
    nivelAdmin: null,
    papel: null,
  },
  {
    id: `${U}10`,
    email: 'vendedora@demo.comerciallin.local',
    nombre: 'Javiera',
    apellido: 'Cortés',
    cargo: 'Ejecutiva de sala',
    empresaId: EMPRESAS.comercialLin.id,
    areaId: AREAS.sala.id,
    roles: ['ESTUDIANTE', 'CAPACITADOR'],
    nivelAdmin: null,
    papel: null,
  },
] as const;

const T = '01993000-0003-7000-8000-0000000000';

export const TEMAS = {
  excel: { id: `${T}01`, empresaId: EMPRESAS.plantaNorte.id, nombre: 'Excel avanzado' },
  prevencion: {
    id: `${T}02`,
    empresaId: EMPRESAS.plantaNorte.id,
    nombre: 'Prevención de riesgos',
  },
  ingles: { id: `${T}03`, empresaId: EMPRESAS.plantaNorte.id, nombre: 'Inglés técnico' },
  hablar: { id: `${T}04`, empresaId: EMPRESAS.plantaNorte.id, nombre: 'Hablar en público' },
  liderazgo: { id: `${T}05`, empresaId: EMPRESAS.plantaNorte.id, nombre: 'Liderazgo de equipos' },
  electrica: {
    id: `${T}06`,
    empresaId: EMPRESAS.plantaNorte.id,
    nombre: 'Mantención eléctrica básica',
  },
  vitrina: { id: `${T}07`, empresaId: EMPRESAS.comercialLin.id, nombre: 'Vitrinismo' },
} as const;

export interface InteresDemo {
  id: string;
  usuarioId: string;
  temaId: string;
  empresaId: string;
  tipo: 'ENSENAR' | 'APRENDER';
  dimensiones: readonly ('HABILIDAD' | 'CONTENIDO' | 'ACTITUD')[];
  nivel: 'BASICO' | 'INTERMEDIO' | 'AVANZADO';
}

const I = '01993000-0004-7000-8000-0000000000';
const PN = EMPRESAS.plantaNorte.id;
const CL = EMPRESAS.comercialLin.id;

/**
 * Pensados para que las métricas digan algo en pantalla:
 * - "Inglés técnico" y "Hablar en público" los quieren varios y **nadie** los enseña: brechas.
 * - "Excel avanzado" tiene oferta y demanda: es lo que más se ofrece.
 * - "Mantención eléctrica básica" no lo declaró nadie: está en el catálogo y no es brecha.
 *
 * Diego (07) va a talleres pero no declaró nada: así RRHH ve "5 de 6 con perfil" en vez de un
 * 100% que no le diría nada.
 */
export const INTERESES: readonly InteresDemo[] = [
  {
    id: `${I}01`,
    usuarioId: `${U}04`,
    temaId: TEMAS.excel.id,
    empresaId: PN,
    tipo: 'ENSENAR',
    dimensiones: ['HABILIDAD', 'CONTENIDO'],
    nivel: 'AVANZADO',
  },
  {
    id: `${I}02`,
    usuarioId: `${U}04`,
    temaId: TEMAS.prevencion.id,
    empresaId: PN,
    tipo: 'ENSENAR',
    dimensiones: ['ACTITUD'],
    nivel: 'INTERMEDIO',
  },
  {
    id: `${I}03`,
    usuarioId: `${U}04`,
    temaId: TEMAS.ingles.id,
    empresaId: PN,
    tipo: 'APRENDER',
    dimensiones: ['HABILIDAD'],
    nivel: 'BASICO',
  },
  {
    id: `${I}04`,
    usuarioId: `${U}05`,
    temaId: TEMAS.excel.id,
    empresaId: PN,
    tipo: 'APRENDER',
    dimensiones: ['CONTENIDO'],
    nivel: 'BASICO',
  },
  {
    id: `${I}05`,
    usuarioId: `${U}05`,
    temaId: TEMAS.ingles.id,
    empresaId: PN,
    tipo: 'APRENDER',
    dimensiones: ['HABILIDAD'],
    nivel: 'BASICO',
  },
  {
    id: `${I}06`,
    usuarioId: `${U}05`,
    temaId: TEMAS.hablar.id,
    empresaId: PN,
    tipo: 'APRENDER',
    dimensiones: ['ACTITUD', 'HABILIDAD'],
    nivel: 'BASICO',
  },
  {
    id: `${I}07`,
    usuarioId: `${U}03`,
    temaId: TEMAS.liderazgo.id,
    empresaId: PN,
    tipo: 'ENSENAR',
    dimensiones: ['ACTITUD'],
    nivel: 'AVANZADO',
  },
  {
    id: `${I}08`,
    usuarioId: `${U}06`,
    temaId: TEMAS.electrica.id,
    empresaId: PN,
    tipo: 'ENSENAR',
    dimensiones: ['HABILIDAD'],
    nivel: 'AVANZADO',
  },
  {
    id: `${I}10`,
    usuarioId: `${U}08`,
    temaId: TEMAS.ingles.id,
    empresaId: PN,
    tipo: 'APRENDER',
    dimensiones: ['HABILIDAD'],
    nivel: 'INTERMEDIO',
  },
  {
    id: `${I}11`,
    usuarioId: `${U}10`,
    temaId: TEMAS.vitrina.id,
    empresaId: CL,
    tipo: 'ENSENAR',
    dimensiones: ['HABILIDAD'],
    nivel: 'INTERMEDIO',
  },
  {
    id: `${I}12`,
    usuarioId: `${U}09`,
    temaId: TEMAS.vitrina.id,
    empresaId: CL,
    tipo: 'APRENDER',
    dimensiones: ['HABILIDAD'],
    nivel: 'BASICO',
  },
];

export interface TallerDemo {
  id: string;
  empresaId: string;
  capacitadorId: string;
  temaId: string;
  nombre: string;
  objetivo: string;
  resultadosEsperados: string;
  ubicacion: string;
  /** Días desde hoy: negativo = ya ocurrió. */
  enDias: number;
  horaInicio: number;
  horaFin: number;
  cupo: number;
  inscritos: readonly string[];
}

const W = '01993000-0005-7000-8000-0000000000';

/**
 * Tres situaciones distintas a propósito: uno con cupo libre para inscribirse en vivo, uno lleno
 * para mostrar que el cupo manda, y uno pasado para que el historial no esté vacío.
 */
export const TALLERES: readonly TallerDemo[] = [
  {
    id: `${W}01`,
    empresaId: PN,
    capacitadorId: `${U}04`,
    temaId: TEMAS.excel.id,
    nombre: 'Excel para turnos',
    objetivo: 'Armar la planilla de turnos sin pelearse con las fórmulas',
    resultadosEsperados: 'Salir con la planilla del mes lista y entendida',
    ubicacion: 'Sala de reuniones, segundo piso',
    enDias: 3,
    horaInicio: 10,
    horaFin: 12,
    cupo: 8,
    inscritos: [`${U}05`, `${U}07`],
  },
  {
    id: `${W}02`,
    empresaId: PN,
    capacitadorId: `${U}04`,
    temaId: TEMAS.prevencion.id,
    nombre: 'Qué hacer antes de que pase',
    objetivo: 'Reconocer los riesgos del área antes de que terminen en un accidente',
    resultadosEsperados: 'Levantar los tres riesgos principales de tu puesto',
    ubicacion: 'Casino, mesa del fondo',
    enDias: 6,
    horaInicio: 15,
    horaFin: 17,
    cupo: 2,
    inscritos: [`${U}07`, `${U}08`],
  },
  {
    id: `${W}03`,
    empresaId: PN,
    capacitadorId: `${U}06`,
    temaId: TEMAS.electrica.id,
    nombre: 'Tableros sin misterio',
    objetivo: 'Entender qué hay detrás de un tablero eléctrico de planta',
    resultadosEsperados: 'Identificar y reponer una protección con seguridad',
    ubicacion: 'Taller de mantención',
    enDias: -9,
    horaInicio: 9,
    horaFin: 11,
    cupo: 6,
    inscritos: [`${U}05`, `${U}07`, `${U}08`],
  },
];

/**
 * Valoraciones del taller que ya pasó, para que la demo no muestre cero estrellas.
 *
 * Van **dos** de los tres asistentes a propósito: la tercera se hace en vivo con la cuenta de
 * Sofía, y ahí se ve el momento en que el promedio empieza a contar en Descubrir
 * (VALORACIONES_PARA_CONTAR_EN_EL_SCORE es 3).
 */
export interface ValoracionDemo {
  id: string;
  tallerId: string;
  empresaId: string;
  usuarioId: string;
  capacitadorId: string;
  asistio: boolean;
  estrellas: Record<string, number>;
  referencia: string;
}

const V = '01993000-0006-7000-8000-0000000000';

export const VALORACIONES: readonly ValoracionDemo[] = [
  {
    id: `${V}01`,
    tallerId: `${W}03`,
    empresaId: PN,
    usuarioId: `${U}05`,
    capacitadorId: `${U}06`,
    asistio: true,
    estrellas: { CLARIDAD: 5, SEGURIDAD: 5, APLICACION: 4, USO_DE_MATERIALES: 4 },
    referencia: 'Explicó el tablero paso a paso y nos dejó tocarlo con el equipo apagado.',
  },
  {
    id: `${V}02`,
    tallerId: `${W}03`,
    empresaId: PN,
    usuarioId: `${U}07`,
    capacitadorId: `${U}06`,
    asistio: true,
    estrellas: { CLARIDAD: 4, SEGURIDAD: 5, APLICACION: 5, USO_DE_MATERIALES: 3 },
    referencia: '',
  },
];

export const DISPONIBILIDAD = [
  { usuarioId: `${U}04`, empresaId: PN, dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' },
  { usuarioId: `${U}04`, empresaId: PN, dia: 'MIERCOLES', horaInicio: '15:00', horaFin: '17:00' },
  { usuarioId: `${U}04`, empresaId: PN, dia: 'VIERNES', horaInicio: '09:00', horaFin: '12:00' },
  { usuarioId: `${U}06`, empresaId: PN, dia: 'MARTES', horaInicio: '14:00', horaFin: '16:00' },
] as const;

/**
 * La contraseña de las cuentas de demo. No se escribe en el código: este repositorio es público
 * y una contraseña versionada es una contraseña quemada.
 */
export function passwordDemo(): string {
  const password = process.env.DEMO_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'Falta DEMO_PASSWORD en el .env de la raíz.\n' +
        'El valor que usamos para la demo está en docs/DEMO.md.',
    );
  }
  if (password.length < 12) {
    throw new Error('DEMO_PASSWORD debe tener al menos 12 caracteres');
  }
  return password;
}

/** Una fecha a N días de hoy, a una hora exacta. Así los talleres nunca "caducan". */
export function fechaRelativa(dias: number, hora: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha;
}

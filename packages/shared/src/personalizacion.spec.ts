import { describe, expect, it } from 'vitest';
import {
  avisosDeContraste,
  contraste,
  derivadosDeMarca,
  guardarPersonalizacionSchema,
  PALETA_POR_OMISION,
} from './personalizacion.js';

describe('contraste', () => {
  it('negro sobre blanco es el máximo de la escala', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('un color contra sí mismo es 1', () => {
    expect(contraste('#00347A', '#00347A')).toBeCloseTo(1, 5);
  });

  it('da lo mismo el orden de los colores', () => {
    expect(contraste('#00347A', '#FFFFFF')).toBeCloseTo(contraste('#FFFFFF', '#00347A'), 5);
  });
});

describe('avisos de contraste', () => {
  it('la plantilla actual no genera ningún aviso', () => {
    // Si este test se cae, la paleta por omisión dejó de ser legible y eso es un problema
    // nuestro, no de ninguna empresa.
    expect(avisosDeContraste(PALETA_POR_OMISION)).toEqual([]);
  });

  it('avisa cuando el texto no se lee sobre el fondo', () => {
    const avisos = avisosDeContraste({ ...PALETA_POR_OMISION, texto: '#EEEEEE' });

    expect(avisos.map((aviso) => aviso.par)).toContain('Texto sobre el fondo');
  });

  it('avisa cuando el color principal es tan claro que el texto blanco desaparece', () => {
    const avisos = avisosDeContraste({ ...PALETA_POR_OMISION, marca: '#FFE08A' });

    expect(avisos.map((aviso) => aviso.par)).toContain('Blanco sobre el color principal');
  });

  it('avisa, pero no impide nada: es solo una lista', () => {
    // La clienta dijo que el contraste lo ven ellos (ADR-0011). Esta función informa.
    const ilegible = { marca: '#FFFFFF', acento: '#FFFFFF', fondo: '#FFFFFF', texto: '#FFFFFF' };

    expect(avisosDeContraste(ilegible)).toHaveLength(2);
    expect(guardarPersonalizacionSchema.safeParse({ colores: ilegible, logo: null }).success).toBe(
      true,
    );
  });
});

describe('derivados del color principal', () => {
  it('el oscuro es más oscuro y el suave es más claro que la marca', () => {
    const { oscuro, suave } = derivadosDeMarca('#00347A');

    expect(contraste(oscuro, '#FFFFFF')).toBeGreaterThan(contraste('#00347A', '#FFFFFF'));
    expect(contraste(suave, '#FFFFFF')).toBeLessThan(contraste('#00347A', '#FFFFFF'));
  });

  it('reproduce la plantilla actual de memoria', () => {
    // Los derivados de #00347A tienen que parecerse a los que estaban escritos a mano en el CSS
    // (#002a63 y #e8eefa). Si se van lejos, una empresa sin personalizar vería otra plataforma.
    const { oscuro, suave } = derivadosDeMarca(PALETA_POR_OMISION.marca);

    expect(contraste(oscuro, '#002A63')).toBeLessThan(1.2);
    expect(contraste(suave, '#E8EEFA')).toBeLessThan(1.2);
  });

  it('funciona con el blanco y el negro sin salirse del rango', () => {
    expect(derivadosDeMarca('#FFFFFF')).toEqual({ oscuro: '#d1d1d1', suave: '#ffffff' });
    expect(derivadosDeMarca('#000000')).toEqual({ oscuro: '#000000', suave: '#e8e8e8' });
  });
});

describe('qué se acepta al guardar', () => {
  const colores = PALETA_POR_OMISION;

  it('exige hexadecimal de seis dígitos: de ahí sale una variable CSS', () => {
    for (const malo of ['rojo', '#FFF', '00347A', 'var(--x)', '#00347A; evil']) {
      const resultado = guardarPersonalizacionSchema.safeParse({
        colores: { ...colores, marca: malo },
        logo: null,
      });
      expect(resultado.success, malo).toBe(false);
    }
  });

  it('acepta un PNG en data URI y rechaza cualquier otra cosa', () => {
    const png = `data:image/png;base64,${'A'.repeat(40)}=`;
    expect(guardarPersonalizacionSchema.safeParse({ colores, logo: png }).success).toBe(true);

    for (const malo of [
      'https://otra-empresa.cl/logo.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PHNjcmlwdD4=',
      'javascript:alert(1)',
    ]) {
      expect(guardarPersonalizacionSchema.safeParse({ colores, logo: malo }).success, malo).toBe(
        false,
      );
    }
  });

  it('un logo enorme no entra', () => {
    const gigante = `data:image/png;base64,${'A'.repeat(200_000)}=`;
    expect(guardarPersonalizacionSchema.safeParse({ colores, logo: gigante }).success).toBe(false);
  });

  it('sin logo es válido: personalizar los colores no obliga a subir nada', () => {
    expect(guardarPersonalizacionSchema.parse({ colores }).logo).toBeNull();
  });
});

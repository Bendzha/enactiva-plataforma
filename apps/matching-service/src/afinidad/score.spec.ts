import { calcularAfinidad, type EntradaAfinidad } from './score.js';

/** El caso de referencia: alguien que quiere aprender y alguien por encima que puede enseñarlo. */
const BASE: EntradaAfinidad = {
  quiereAprender: { dimensiones: ['HABILIDAD'], nivel: 'BASICO' },
  puedeEnsenar: { dimensiones: ['HABILIDAD'], nivel: 'AVANZADO' },
  mismaArea: true,
  valoracionFacilitador: null,
};

const con = (cambios: Partial<EntradaAfinidad>): EntradaAfinidad => ({ ...BASE, ...cambios });

describe('score de afinidad', () => {
  it('el calce perfecto da 100', () => {
    expect(calcularAfinidad(BASE).score).toBe(100);
  });

  it('un taller de un tema que la persona nunca declaró queda al fondo, pero no desaparece', () => {
    const { score, detalle } = calcularAfinidad(con({ quiereAprender: null }));

    // Solo suma el área: ni dimensiones ni nivel se pueden comparar contra nada.
    expect(detalle.dimensiones).toBe(0);
    expect(detalle.nivel).toBe(0);
    expect(score).toBe(33);
  });

  it('quien publica sin haber declarado el tema igual aparece, con lo que se puede medir', () => {
    expect(calcularAfinidad(con({ puedeEnsenar: null })).score).toBe(33);
  });

  describe('dimensiones', () => {
    it('cubrir la mitad de lo que se pide vale la mitad', () => {
      const mitad = con({
        quiereAprender: { dimensiones: ['HABILIDAD', 'ACTITUD'], nivel: 'BASICO' },
        puedeEnsenar: { dimensiones: ['HABILIDAD'], nivel: 'AVANZADO' },
      });

      expect(calcularAfinidad(mitad).detalle.dimensiones).toBe(0.5);
    });

    it('ofrecer de más no penaliza: se mide lo que se pide, no lo que sobra', () => {
      const deMas = con({
        quiereAprender: { dimensiones: ['HABILIDAD'], nivel: 'BASICO' },
        puedeEnsenar: { dimensiones: ['HABILIDAD', 'CONTENIDO', 'ACTITUD'], nivel: 'AVANZADO' },
      });

      expect(calcularAfinidad(deMas).detalle.dimensiones).toBe(1);
      expect(calcularAfinidad(deMas).score).toBe(100);
    });

    it('sin ninguna dimensión en común, ese criterio es cero', () => {
      const sinCalce = con({
        quiereAprender: { dimensiones: ['ACTITUD'], nivel: 'BASICO' },
        puedeEnsenar: { dimensiones: ['CONTENIDO'], nivel: 'AVANZADO' },
      });

      expect(calcularAfinidad(sinCalce).detalle.dimensiones).toBe(0);
    });
  });

  describe('nivel', () => {
    it('aprender de alguien por encima vale el máximo', () => {
      expect(calcularAfinidad(BASE).detalle.nivel).toBe(1);
    });

    it('del mismo nivel sirve a medias', () => {
      const parejo = con({
        quiereAprender: { dimensiones: ['HABILIDAD'], nivel: 'INTERMEDIO' },
        puedeEnsenar: { dimensiones: ['HABILIDAD'], nivel: 'INTERMEDIO' },
      });

      expect(calcularAfinidad(parejo).detalle.nivel).toBe(0.6);
    });

    it('de alguien por debajo no suma nada', () => {
      const alReves = con({
        quiereAprender: { dimensiones: ['HABILIDAD'], nivel: 'AVANZADO' },
        puedeEnsenar: { dimensiones: ['HABILIDAD'], nivel: 'BASICO' },
      });

      expect(calcularAfinidad(alReves).detalle.nivel).toBe(0);
      // Sigue apareciendo: dimensiones y área sí calzan.
      expect(calcularAfinidad(alReves).score).toBe(67);
    });
  });

  describe('área', () => {
    it('hoy la misma área suma, y es un supuesto nuestro marcado en la SPEC', () => {
      expect(calcularAfinidad(BASE).detalle.area).toBe(1);
      expect(calcularAfinidad(con({ mismaArea: false })).detalle.area).toBe(0);
    });

    it('estar en otra área baja el score, no lo anula', () => {
      expect(calcularAfinidad(con({ mismaArea: false })).score).toBe(67);
    });
  });

  describe('valoración del facilitador', () => {
    it('mientras no existan estrellas, el criterio no participa del promedio', () => {
      const sinEstrellas = calcularAfinidad(con({ mismaArea: false }));
      // Tres criterios: dos de tres, no dos de cuatro.
      expect(sinEstrellas.score).toBe(67);
      expect(sinEstrellas.detalle.valoracion).toBeUndefined();
    });

    it('cinco estrellas valen uno y una estrella vale cero', () => {
      expect(calcularAfinidad(con({ valoracionFacilitador: 5 })).detalle.valoracion).toBe(1);
      expect(calcularAfinidad(con({ valoracionFacilitador: 1 })).detalle.valoracion).toBe(0);
    });

    it('con estrellas, el peso se reparte entre los cuatro criterios', () => {
      // Todo perfecto menos la valoración, que está en el medio: 3 de 4 criterios en 1.
      const conEstrellas = calcularAfinidad(con({ valoracionFacilitador: 3 }));
      expect(conEstrellas.score).toBe(88);
    });

    it('una valoración fuera de rango no rompe el cálculo', () => {
      expect(calcularAfinidad(con({ valoracionFacilitador: 9 })).detalle.valoracion).toBe(1);
      expect(calcularAfinidad(con({ valoracionFacilitador: -2 })).detalle.valoracion).toBe(0);
    });
  });

  it('el score siempre queda entre 0 y 100', () => {
    const peor = calcularAfinidad({
      quiereAprender: null,
      puedeEnsenar: null,
      mismaArea: false,
      valoracionFacilitador: 1,
    });

    expect(peor.score).toBe(0);
    expect(calcularAfinidad(con({ valoracionFacilitador: 5 })).score).toBe(100);
  });
});

import { describe, it, expect } from 'vitest';
import { calcularEstadoCuenta } from '../../api/_lib/estadoCuenta';

describe('calcularEstadoCuenta', () => {
  it('is "vencido" when there are no tickets disponibles', () => {
    expect(calcularEstadoCuenta(0, new Date(Date.now() + 30 * 86400000))).toBe('vencido');
  });
  it('is "vencido" when vencimiento already passed', () => {
    expect(calcularEstadoCuenta(5, new Date(Date.now() - 86400000))).toBe('vencido');
  });
  it('is "por_vencer" when <=2 tickets remain or vencimiento is within 7 days', () => {
    expect(calcularEstadoCuenta(2, new Date(Date.now() + 30 * 86400000))).toBe('por_vencer');
    expect(calcularEstadoCuenta(8, new Date(Date.now() + 5 * 86400000))).toBe('por_vencer');
  });
  it('is "activo" otherwise', () => {
    expect(calcularEstadoCuenta(8, new Date(Date.now() + 30 * 86400000))).toBe('activo');
  });
});

export type EstadoCuenta = 'activo' | 'por_vencer' | 'vencido';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const UMBRAL_TICKETS_BAJOS = 2;

export function calcularEstadoCuenta(ticketsDisponibles: number, vencimiento: Date | null): EstadoCuenta {
  if (ticketsDisponibles <= 0) return 'vencido';
  if (!vencimiento) return 'activo';
  if (vencimiento.getTime() < Date.now()) return 'vencido';
  if (ticketsDisponibles <= UMBRAL_TICKETS_BAJOS || vencimiento.getTime() - Date.now() <= SIETE_DIAS_MS) return 'por_vencer';
  return 'activo';
}

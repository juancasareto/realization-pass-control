export const CATEGORIAS_INGRESO = [
  { value: 'DIA_SUELTO', label: 'Día suelto de muro' },
  { value: 'ALQUILER_MURO', label: 'Alquiler de muro' },
  { value: 'OTRO_INGRESO', label: 'Otro ingreso' },
] as const;

export const CATEGORIAS_EGRESO = [
  { value: 'SUELDOS', label: 'Sueldos' },
  { value: 'ALQUILER', label: 'Alquiler local' },
  { value: 'SERVICIOS', label: 'Servicios' },
  { value: 'INSUMOS', label: 'Compra de insumos' },
  { value: 'RETIRO_SOCIOS', label: 'Retiro de socios' },
  { value: 'OTRO_EGRESO', label: 'Otro egreso' },
] as const;

export const MEDIOS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
] as const;

const CATEGORIA_LABEL: Record<string, string> = {
  PLAN: 'Venta de plan',
  ...Object.fromEntries(CATEGORIAS_INGRESO.map((c) => [c.value, c.label])),
  ...Object.fromEntries(CATEGORIAS_EGRESO.map((c) => [c.value, c.label])),
};

export function labelCategoria(categoria: string): string {
  return CATEGORIA_LABEL[categoria] ?? categoria;
}

const MEDIO_LABEL: Record<string, string> = Object.fromEntries(MEDIOS.map((m) => [m.value, m.label]));

export function labelMedio(medio: string): string {
  return MEDIO_LABEL[medio] ?? medio;
}

const LABELS: Record<string, string> = { activo: 'Activo', por_vencer: 'Por vencer', vencido: 'Vencido' };
// Chip siempre oscuro con texto siempre brillante, fijo independiente del tema
// (el chip no usa var(--ink-raised) a propósito: es un rótulo semántico, no una superficie de la UI).
const COLORS: Record<string, string> = {
  activo: 'bg-[#173322] text-[#4fae6d]',
  por_vencer: 'bg-[#3a2712] text-[#d97b29]',
  vencido: 'bg-[#3a1a15] text-[#e1503d]',
};

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`font-mono text-xs uppercase px-2 py-1 rounded-md ${COLORS[estado]}`}>{LABELS[estado]}</span>;
}

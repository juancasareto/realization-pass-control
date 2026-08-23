const LABELS: Record<string, string> = { activo: 'Activo', por_vencer: 'Por vencer', vencido: 'Vencido' };
const COLORS: Record<string, string> = {
  activo: 'bg-[#173322] text-[var(--good)]',
  por_vencer: 'bg-[#3a2712] text-[var(--warn)]',
  vencido: 'bg-[#3a1a15] text-[var(--crit)]',
};

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`font-mono text-xs uppercase px-2 py-1 ${COLORS[estado]}`}>{LABELS[estado]}</span>;
}

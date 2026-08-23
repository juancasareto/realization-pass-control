const LABELS: Record<string, string> = { PENDIENTE: 'Pendiente', PRESENTE: 'Presente', AVISO_AUSENCIA: 'Aviso ausencia', RECUPERADA: 'Recuperada', PENALIZADA: 'Penalizada' };
const COLORS: Record<string, string> = {
  PENDIENTE: 'text-[var(--rock)]',
  PRESENTE: 'text-[var(--good)]',
  AVISO_AUSENCIA: 'text-[var(--aviso)]',
  RECUPERADA: 'text-[var(--gold-soft)]',
  PENALIZADA: 'text-[var(--crit)]',
};

export function AsistenciaBadge({ estado }: { estado: string }) {
  return <span className={`font-mono text-xs uppercase ${COLORS[estado]}`}>{LABELS[estado]}</span>;
}

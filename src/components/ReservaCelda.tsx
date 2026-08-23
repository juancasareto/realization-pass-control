export type CeldaReserva = {
  id: string;
  clienteNombre: string;
  clienteId: string;
  estadoAsistencia: string;
};

export type Celda = {
  key: string;
  fecha: Date;
  tipoClase: string;
  hora: string;
  horarioId: string | null;
  cupoMaximo: number | null;
  profesorNombre: string | null;
  reservas: CeldaReserva[];
};

function fillColor(pct: number): { border: string; bg: string } {
  if (pct >= 100) return { border: 'var(--crit)', bg: 'rgb(225 80 61 / 0.08)' };
  if (pct >= 75) return { border: 'var(--warn)', bg: 'rgb(217 123 41 / 0.08)' };
  if (pct >= 40) return { border: 'var(--gold)', bg: 'rgb(241 180 0 / 0.06)' };
  if (pct > 0) return { border: 'var(--good)', bg: 'rgb(79 174 109 / 0.06)' };
  return { border: 'var(--ink-line)', bg: 'transparent' };
}

export function ReservaCelda({ celda, onClick }: { celda: Celda; onClick: () => void }) {
  const ocupacion = celda.reservas.length;
  const cupo = celda.cupoMaximo ?? 0;
  const pct = cupo > 0 ? (ocupacion / cupo) * 100 : 0;
  const c = fillColor(pct);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 border transition-all hover:brightness-125"
      style={{ borderColor: c.border, background: c.bg }}
    >
      <p className="font-mono tabular-nums text-[11px] text-[var(--rock)]">{celda.hora}</p>
      <p className="text-xs text-[var(--chalk)] font-medium truncate">{celda.tipoClase}</p>
      <p className="text-[11px] font-mono tabular-nums mt-1" style={{ color: c.border }}>
        {ocupacion}{cupo > 0 ? `/${cupo}` : ''}
      </p>
    </button>
  );
}

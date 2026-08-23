type Punto = { fecha: string; total: number };

export function IngresosSparkline({ datos }: { datos: Punto[] }) {
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
      <p className="text-xs uppercase text-[var(--rock)] mb-3">Ingresos — últimos 7 días</p>
      <div className="flex items-end gap-2 h-24">
        {datos.map((d) => (
          <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-[var(--gold)]" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? '4px' : '1px' }} title={`$${d.total}`} />
            <span className="text-[10px] text-[var(--rock-dim)] font-mono">{d.fecha.slice(8, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

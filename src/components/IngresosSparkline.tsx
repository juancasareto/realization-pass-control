type Punto = { fecha: string; total: number };

function fmtCompacto(n: number): string {
  if (n === 0) return '$0';
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

export function IngresosSparkline({ datos }: { datos: Punto[] }) {
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5 rounded-md h-full flex flex-col">
      <p className="text-xs uppercase text-[var(--rock)] mb-4 shrink-0">Ingresos — últimos 7 días</p>
      <div className="flex-1 flex gap-2 min-h-24">
        {datos.map((d) => (
          <div key={d.fecha} className="flex-1 h-full flex flex-col items-center gap-1.5">
            <span className={`text-[10px] font-mono tabular-nums shrink-0 ${d.total > 0 ? 'text-[var(--gold)]' : 'text-[var(--rock-dim)]'}`}>
              {fmtCompacto(d.total)}
            </span>
            <div className="flex-1 w-full flex items-end">
              <div
                className="w-full bg-[var(--gold)] rounded-sm"
                style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? '4px' : '1px' }}
                title={`$${d.total.toLocaleString('es-AR')}`}
              />
            </div>
            <span className="text-[10px] text-[var(--rock-dim)] font-mono shrink-0">{d.fecha.slice(8, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

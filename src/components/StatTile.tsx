import type { ReactNode } from 'react';

export function StatTile({ label, value, footer }: { label: string; value: string | number; footer?: ReactNode }) {
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5 flex flex-col justify-between">
      <div>
        <p className="font-mono tabular-nums text-4xl mb-1">{value}</p>
        <p className="text-xs uppercase text-[var(--rock)]">{label}</p>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

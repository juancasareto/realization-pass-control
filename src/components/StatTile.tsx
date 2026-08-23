export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
      <p className="font-mono tabular-nums text-4xl mb-1">{value}</p>
      <p className="text-xs uppercase text-[var(--rock)]">{label}</p>
    </div>
  );
}

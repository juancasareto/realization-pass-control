type Punto = { fecha: string; total: number };

export function StatSparkline({ datos, colorVar = '--gold' }: { datos: Punto[]; colorVar?: string }) {
  if (!datos || datos.length === 0) return null;
  const max = Math.max(...datos.map((d) => d.total), 1);
  const width = 100;
  const height = 32;
  const step = width / (datos.length - 1 || 1);
  const points = datos.map((d, i) => `${i * step},${height - (d.total / max) * height}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={`var(${colorVar})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
}

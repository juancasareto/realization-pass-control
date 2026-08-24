import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { RegistrarPagoModal } from '../components/RegistrarPagoModal';
import { RegistrarIngresoModal } from '../components/RegistrarIngresoModal';
import { RegistrarGastoModal } from '../components/RegistrarGastoModal';
import { labelCategoria, labelMedio } from '../lib/contable';

type Movimiento = {
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  medio: string;
  monto: number;
  descripcion: string;
  clienteNombre: string | null;
  fecha: string;
};

type Caja = { medio: string; entradas: number; retiros: number; saldo: number };

type Reporte = {
  totalIngresos: number;
  totalEgresos: number;
  neto: number;
  porCategoriaIngreso: Record<string, number>;
  porCategoriaEgreso: Record<string, number>;
};

function mesActualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function movimientosToCsv(movimientos: Movimiento[]): string {
  const header = 'Fecha,Tipo,Categoría,Medio,Monto,Descripción,Alumno';
  const rows = movimientos.map((m) => [
    new Date(m.fecha).toISOString(),
    m.tipo,
    labelCategoria(m.categoria),
    labelMedio(m.medio),
    m.monto,
    `"${(m.descripcion ?? '').replace(/"/g, '""')}"`,
    m.clienteNombre ?? '',
  ].join(','));
  return [header, ...rows].join('\n');
}

function descargarCsv(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);
}

export function CobrosPage() {
  const { token } = useAuth();
  const [mes, setMes] = useState(mesActualIso());
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [tab, setTab] = useState<'mov' | 'reporte'>('mov');
  const [modalOpen, setModalOpen] = useState<null | 'pago' | 'ingreso' | 'gasto'>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/cobros?mes=${mes}`, {}, token);
      setCajas(data.cajas ?? []);
      setMovimientos(data.movimientos ?? []);
      setReporte(data.reporte ?? null);
    } finally {
      setLoading(false);
    }
  }, [token, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const meses = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      list.push({ value, label });
    }
    return list;
  }, []);

  function exportarCsv() {
    const csv = movimientosToCsv(movimientos);
    descargarCsv(`cobros-${mes}.csv`, csv);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="font-['Anton'] uppercase text-2xl">Cobros</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)] transition-colors capitalize rounded-md">
            {meses.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button onClick={exportarCsv} className="flex items-center gap-2 px-3 py-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-xs uppercase tracking-wide transition-colors rounded-md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="square" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <button onClick={() => setModalOpen('pago')} className="flex items-center gap-3 border border-[var(--ink-line)] bg-[var(--ink-raised)] hover:border-[var(--gold)] p-4 text-left transition-colors rounded-md">
          <div className="w-10 h-10 flex items-center justify-center border border-[var(--gold)] shrink-0 rounded-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--gold)" strokeWidth={1.5}><path strokeLinecap="square" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--chalk)]">Cobrar plan</p>
            <p className="text-[11px] text-[var(--rock)] mt-0.5">Venta de plan a un alumno</p>
          </div>
        </button>
        <button onClick={() => setModalOpen('ingreso')} className="flex items-center gap-3 border border-[var(--ink-line)] bg-[var(--ink-raised)] hover:border-[var(--good)] p-4 text-left transition-colors rounded-md">
          <div className="w-10 h-10 flex items-center justify-center border border-[var(--good)] shrink-0 rounded-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--good)" strokeWidth={1.5}><path strokeLinecap="square" d="M12 4v16m8-8H4"/></svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--chalk)]">Registrar ingreso</p>
            <p className="text-[11px] text-[var(--rock)] mt-0.5">Día suelto, alquiler muro, otros</p>
          </div>
        </button>
        <button onClick={() => setModalOpen('gasto')} className="flex items-center gap-3 border border-[var(--ink-line)] bg-[var(--ink-raised)] hover:border-[var(--crit)] p-4 text-left transition-colors rounded-md">
          <div className="w-10 h-10 flex items-center justify-center border border-[var(--crit)] shrink-0 rounded-md">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--crit)" strokeWidth={1.5}><path strokeLinecap="square" d="M20 12H4"/></svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-[var(--chalk)]">Registrar gasto</p>
            <p className="text-[11px] text-[var(--rock)] mt-0.5">Sueldos, alquiler, insumos, retiros</p>
          </div>
        </button>
      </div>

      {/* Cajas por medio de pago */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {cajas.map((c) => (
          <div key={c.medio} className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-4 rounded-md">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock)] mb-2">{labelMedio(c.medio)}</p>
            <p className="font-mono tabular-nums text-2xl text-[var(--chalk)]">{fmtMoney(c.saldo)}</p>
            <p className="text-[11px] text-[var(--rock-dim)] mt-1 font-mono tabular-nums">
              <span className="text-[var(--good)]">+{fmtMoney(c.entradas)}</span> / <span className="text-[var(--crit)]">-{fmtMoney(c.retiros)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--ink-line)] mb-4 flex gap-1">
        <TabBtn active={tab === 'mov'} onClick={() => setTab('mov')} label="Movimientos" />
        <TabBtn active={tab === 'reporte'} onClick={() => setTab('reporte')} label="Reporte mensual" />
      </div>

      {loading && <p className="text-sm text-[var(--rock-dim)]">Cargando…</p>}

      {tab === 'mov' && !loading && (
        movimientos.length === 0 ? (
          <p className="p-4 text-sm text-[var(--rock-dim)] border border-[var(--ink-line)] rounded-md">Sin movimientos en este período.</p>
        ) : (
          <div className="border border-[var(--ink-line)] rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock-dim)] bg-[var(--ink-raised)]">
                <tr>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-left px-4 py-3">Descripción</th>
                  <th className="text-left px-4 py-3">Medio</th>
                  <th className="text-right px-4 py-3">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={i} className="border-t border-[var(--ink-line)]">
                    <td className="px-4 py-3 font-mono tabular-nums text-[var(--rock)]">{new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] uppercase tracking-wide ${m.tipo === 'ingreso' ? 'text-[var(--good)]' : 'text-[var(--crit)]'}`}>
                        {labelCategoria(m.categoria)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--chalk)]">
                      {m.descripcion || '—'}
                      {m.clienteNombre && <span className="text-[11px] text-[var(--rock)] block">{m.clienteNombre}</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--rock)]">{labelMedio(m.medio)}</td>
                    <td className={`px-4 py-3 font-mono tabular-nums text-right font-bold ${m.tipo === 'ingreso' ? 'text-[var(--good)]' : 'text-[var(--crit)]'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{fmtMoney(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'reporte' && !loading && reporte && (
        <ReporteMensual reporte={reporte} />
      )}

      <RegistrarPagoModal open={modalOpen === 'pago'} onClose={() => setModalOpen(null)} onSaved={cargar} />
      <RegistrarIngresoModal open={modalOpen === 'ingreso'} onClose={() => setModalOpen(null)} onSaved={cargar} />
      <RegistrarGastoModal open={modalOpen === 'gasto'} onClose={() => setModalOpen(null)} onSaved={cargar} />
    </div>
  );
}

function ReporteMensual({ reporte }: { reporte: Reporte }) {
  const ingresos = Object.entries(reporte.porCategoriaIngreso).sort((a, b) => b[1] - a[1]);
  const egresos = Object.entries(reporte.porCategoriaEgreso).sort((a, b) => b[1] - a[1]);
  const netoColor = reporte.neto >= 0 ? 'text-[var(--good)]' : 'text-[var(--crit)]';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Ingresos" value={fmtMoney(reporte.totalIngresos)} color="var(--good)" />
        <SummaryCard label="Egresos" value={fmtMoney(reporte.totalEgresos)} color="var(--crit)" />
        <SummaryCard label="Neto" value={fmtMoney(reporte.neto)} color={reporte.neto >= 0 ? 'var(--good)' : 'var(--crit)'} highlight />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-[var(--ink-line)] rounded-md overflow-hidden">
          <p className="px-4 py-3 text-xs uppercase tracking-[0.15em] text-[var(--good)] border-b border-[var(--ink-line)]">Ingresos por categoría</p>
          {ingresos.length === 0 && <p className="p-4 text-sm text-[var(--rock-dim)]">Sin ingresos.</p>}
          {ingresos.map(([cat, monto]) => (
            <div key={cat} className="flex justify-between px-4 py-2.5 border-t border-[var(--ink-line)] text-sm">
              <span className="text-[var(--chalk)]">{labelCategoria(cat)}</span>
              <span className="font-mono tabular-nums text-[var(--good)]">{fmtMoney(monto)}</span>
            </div>
          ))}
        </div>

        <div className="border border-[var(--ink-line)] rounded-md overflow-hidden">
          <p className="px-4 py-3 text-xs uppercase tracking-[0.15em] text-[var(--crit)] border-b border-[var(--ink-line)]">Egresos por categoría</p>
          {egresos.length === 0 && <p className="p-4 text-sm text-[var(--rock-dim)]">Sin egresos.</p>}
          {egresos.map(([cat, monto]) => (
            <div key={cat} className="flex justify-between px-4 py-2.5 border-t border-[var(--ink-line)] text-sm">
              <span className="text-[var(--chalk)]">{labelCategoria(cat)}</span>
              <span className="font-mono tabular-nums text-[var(--crit)]">{fmtMoney(monto)}</span>
            </div>
          ))}
        </div>
      </div>

      {reporte.neto !== 0 && (
        <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-4 text-center rounded-md">
          <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--rock)]">Resultado del período</p>
          <p className={`font-mono tabular-nums text-3xl mt-2 ${netoColor}`}>{fmtMoney(reporte.neto)}</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`border p-4 rounded-md ${highlight ? 'bg-[var(--ink-raised)]' : ''}`} style={{ borderColor: highlight ? color : 'var(--ink-line)' }}>
      <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock)]">{label}</p>
      <p className="font-mono tabular-nums text-2xl mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm uppercase tracking-wide border-b-2 -mb-px transition-colors ${
        active
          ? 'border-[var(--gold)] text-[var(--gold)]'
          : 'border-transparent text-[var(--rock)] hover:text-[var(--chalk)]'
      }`}
    >
      {label}
    </button>
  );
}

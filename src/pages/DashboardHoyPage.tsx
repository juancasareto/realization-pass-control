import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { StatTile } from '../components/StatTile';
import { StatSparkline } from '../components/StatSparkline';
import { IngresosSparkline } from '../components/IngresosSparkline';
import { EstadoBadge } from '../components/EstadoBadge';
import { QuickActionsBar } from '../components/QuickActionsBar';
import { ReservasHoyList } from '../components/ReservasHoyList';

export function DashboardHoyPage() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/dashboard/hoy', {}, token);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  function refrescarTodo() {
    setRefreshTick((n) => n + 1);
    cargar();
  }

  if (!data) return <p>Cargando…</p>;

  const checkIns7d = data.checkInsUltimos7Dias ?? [];
  const totalCheckIns7d = checkIns7d.reduce((s: number, d: any) => s + d.total, 0);
  const planesPorVencer = data.planesPorVencer ?? data.alumnosAlerta ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">Hoy</h2>
        <button
          onClick={refrescarTodo}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-xs uppercase tracking-wide transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="square" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      <QuickActionsBar onSaved={refrescarTodo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="Check-ins hoy" value={data.checkInsHoy} />
        <StatTile label="Reservas hoy" value={data.reservasHoy} />
        <StatTile label="Cobrado hoy" value={`$${data.cobrosHoyTotal.toLocaleString('es-AR')}`} />
        <StatTile
          label="Check-ins 7d"
          value={totalCheckIns7d}
          footer={<StatSparkline datos={checkIns7d} />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <IngresosSparkline datos={data.ingresosUltimos7Dias} />
        <ReservasHoyList refreshKey={refreshTick} onSaved={refrescarTodo} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--rock)] p-4 border-b border-[var(--ink-line)]">Planes por vencer / vencidos</p>
          {planesPorVencer.length === 0 ? (
            <p className="p-4 text-sm text-[var(--rock-dim)]">Sin alumnos por vencer.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {planesPorVencer.map((a: any) => (
                  <tr key={a.id} className="border-t border-[var(--ink-line)]">
                    <td className="p-4"><Link to={`/admin/clientes/${a.id}`} className="hover:text-[var(--gold)]">{a.nombre}</Link></td>
                    <td className="p-4 font-mono tabular-nums">{a.ticketsDisponibles} tickets</td>
                    <td className="p-4"><EstadoBadge estado={a.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--warn)] p-4 border-b border-[var(--ink-line)]">Faltas pendientes de recuperar</p>
          {data.pendientesDeRecuperar.length === 0 ? (
            <p className="p-4 text-sm text-[var(--rock-dim)]">Sin faltas pendientes.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.pendientesDeRecuperar.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-[var(--ink-line)]">
                    <td className="p-4"><Link to={`/admin/clientes/${p.clienteId}`} className="hover:text-[var(--gold)]">{p.clienteNombre}</Link></td>
                    <td className="p-4 font-mono tabular-nums text-[var(--warn)]">{p.diasRestantes} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

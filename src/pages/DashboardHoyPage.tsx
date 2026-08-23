import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { StatTile } from '../components/StatTile';
import { IngresosSparkline } from '../components/IngresosSparkline';
import { EstadoBadge } from '../components/EstadoBadge';

export function DashboardHoyPage() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => { apiFetch('/api/admin/dashboard/hoy', {}, token).then(setData); }, [token]);

  if (!data) return <p>Cargando…</p>;

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Hoy</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatTile label="Check-ins hoy" value={data.checkInsHoy} />
        <StatTile label="Reservas hoy" value={data.reservasHoy} />
        <StatTile label="Cobrado hoy" value={`$${data.cobrosHoyTotal.toLocaleString('es-AR')}`} />
        <StatTile label="Alumnos en alerta" value={data.alumnosAlerta.length} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <IngresosSparkline datos={data.ingresosUltimos7Dias} />
        <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
          <p className="text-xs uppercase text-[var(--rock)] mb-3">Check-ins recientes</p>
          <ul className="text-sm space-y-2">
            {data.checkInsRecientes.map((c: any, i: number) => (
              <li key={i} className="flex justify-between">
                <span>{c.clienteNombre}</span>
                <span className="font-mono tabular-nums text-[var(--rock)]">{new Date(c.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--rock)] p-4 border-b border-[var(--ink-line)]">Alumnos que necesitan atención</p>
          <table className="w-full text-sm">
            <tbody>
              {data.alumnosAlerta.map((a: any) => (
                <tr key={a.id} className="border-t border-[var(--ink-line)]">
                  <td className="p-4"><Link to={`/admin/clientes/${a.id}`} className="hover:text-[var(--gold)]">{a.nombre}</Link></td>
                  <td className="p-4 font-mono tabular-nums">{a.ticketsDisponibles} tickets</td>
                  <td className="p-4"><EstadoBadge estado={a.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--warn)] p-4 border-b border-[var(--ink-line)]">Faltas pendientes de recuperar</p>
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
        </div>
      </div>
    </div>
  );
}

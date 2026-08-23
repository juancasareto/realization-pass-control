import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';

type ClienteRow = { id: string; nombre: string; email: string; ticketsDisponibles: number; estado: string };

export function ClientesPage() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    apiFetch(`/api/admin/clientes?${params.toString()}`, {}, token).then((data) => setClientes(data.clientes));
  }, [q, estado, token]);

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Alumnos</h2>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Buscar por nombre o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="por_vencer">Por vencer</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Nombre</th><th className="text-left py-2">Tickets</th><th className="text-left py-2">Estado</th></tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3"><Link to={`/admin/clientes/${c.id}`} className="hover:text-[var(--gold)]">{c.nombre}</Link></td>
              <td className="py-3 font-mono tabular-nums">{c.ticketsDisponibles}</td>
              <td className="py-3"><EstadoBadge estado={c.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

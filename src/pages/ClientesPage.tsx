import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';
import { NuevoAlumnoModal } from '../components/NuevoAlumnoModal';
import { FichaAlumnoModal } from '../components/FichaAlumnoModal';

type ClienteRow = { id: string; nombre: string; email: string; ticketsDisponibles: number; estado: string };

export function ClientesPage() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (estado) params.set('estado', estado);
      const data = await apiFetch(`/api/admin/clientes?${params.toString()}`, {}, token);
      setClientes(data.clientes);
    } finally {
      setLoading(false);
    }
  }, [q, estado, token]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">Alumnos</h2>
        <button
          onClick={() => setNuevoOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-[var(--ink)] text-xs uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo alumno
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="Buscar por nombre o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)] transition-colors"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)] transition-colors"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="por_vencer">Por vencer</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>

      <div className="border border-[var(--ink-line)]">
        {loading && clientes.length === 0 && <p className="p-4 text-sm text-[var(--rock-dim)]">Cargando…</p>}
        {!loading && clientes.length === 0 && <p className="p-4 text-sm text-[var(--rock-dim)]">Sin alumnos que coincidan con la búsqueda.</p>}
        {clientes.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-[var(--rock-dim)] uppercase text-[10px] tracking-[0.15em]">
              <tr className="border-b border-[var(--ink-line)]">
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="text-right px-4 py-3">Tickets</th>
                <th className="text-left px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setFichaId(c.id)}
                  className="border-t border-[var(--ink-line)] hover:bg-[rgb(255_255_255/0.03)] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-[var(--chalk)]">{c.nombre}</td>
                  <td className="px-4 py-3 text-[var(--rock)] hidden sm:table-cell truncate">{c.email}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-right">{c.ticketsDisponibles}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NuevoAlumnoModal open={nuevoOpen} onClose={() => setNuevoOpen(false)} onCreated={cargar} />
      <FichaAlumnoModal
        clienteId={fichaId}
        open={fichaId !== null}
        onClose={() => setFichaId(null)}
        onUpdated={cargar}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

type Modalidad = { id: string; nombre: string; tipo: string; conZapas: boolean; cantTickets: number; precio: number; activo: boolean };

export function ModalidadesPage() {
  const { token } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);

  useEffect(() => { apiFetch('/api/admin/modalidades', {}, token).then((data) => setModalidades(data.modalidades)); }, [token]);

  async function toggleActivo(m: Modalidad) {
    await apiFetch(`/api/admin/modalidades?id=${m.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !m.activo }) }, token);
    setModalidades((prev) => prev.map((x) => (x.id === m.id ? { ...x, activo: !x.activo } : x)));
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Planes</h2>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Nombre</th><th className="text-left py-2">Tipo</th><th className="text-left py-2">Zapas</th><th className="text-left py-2">Tickets</th><th className="text-left py-2">Precio</th><th className="text-left py-2">Activo</th></tr>
        </thead>
        <tbody>
          {modalidades.map((m) => (
            <tr key={m.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">{m.nombre}</td>
              <td className="py-3">{m.tipo}</td>
              <td className="py-3">{m.conZapas ? 'Con zapas' : 'Sin zapas'}</td>
              <td className="py-3 font-mono tabular-nums">{m.cantTickets}</td>
              <td className="py-3 font-mono tabular-nums">${m.precio}</td>
              <td className="py-3"><input type="checkbox" checked={m.activo} onChange={() => toggleActivo(m)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

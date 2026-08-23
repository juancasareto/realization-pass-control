import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { PlanModal, type Plan } from '../components/PlanModal';

export function ModalidadesPage() {
  const { token } = useAuth();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInactivos, setShowInactivos] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/modalidades', {}, token);
      setPlanes(data.modalidades ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleActivo(p: Plan) {
    await apiFetch(`/api/admin/modalidades?id=${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: !p.activo }),
    }, token);
    cargar();
  }

  async function eliminar(p: Plan) {
    const usos = p.comprasCount ?? 0;
    if (usos > 0) {
      alert(`Este plan tiene ${usos} compra(s) asociada(s). Desactivá el plan en vez de eliminarlo.`);
      return;
    }
    if (!confirm(`¿Eliminar el plan "${p.nombre}"?`)) return;
    try {
      await apiFetch(`/api/admin/modalidades?id=${p.id}`, { method: 'DELETE' }, token);
      cargar();
    } catch (err: any) {
      alert(err?.message ?? 'No pudimos eliminar el plan.');
    }
  }

  function abrirNuevo() { setEditing(null); setModalOpen(true); }
  function abrirEdit(p: Plan) { setEditing(p); setModalOpen(true); }

  const visibles = showInactivos ? planes : planes.filter((p) => p.activo);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="font-['Anton'] uppercase text-2xl">Planes</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--rock)] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactivos}
              onChange={(e) => setShowInactivos(e.target.checked)}
              className="accent-[var(--gold)]"
            />
            Mostrar inactivos
          </label>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-[var(--ink)] text-xs uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="square" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo plan
          </button>
        </div>
      </div>

      {loading && planes.length === 0 && <p className="text-sm text-[var(--rock-dim)]">Cargando…</p>}

      {!loading && visibles.length === 0 && (
        <div className="border border-[var(--ink-line)] p-8 text-center">
          <p className="text-[var(--rock)] mb-3">No hay planes cargados todavía.</p>
          <button onClick={abrirNuevo} className="text-[var(--gold)] text-sm uppercase tracking-wide hover:underline">
            Crear el primero
          </button>
        </div>
      )}

      {visibles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((p) => {
            const puedeEliminar = (p.comprasCount ?? 0) === 0;
            return (
              <div
                key={p.id}
                className={`border p-5 flex flex-col gap-4 ${p.activo ? 'border-[var(--ink-line)] bg-[var(--ink-raised)]' : 'border-[var(--ink-line)] bg-[var(--ink-raised)] opacity-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm uppercase tracking-wide text-[var(--gold)]">{p.tipo === 'CLASES' ? 'Clases' : 'Libre'}</p>
                    <h3 className="text-lg font-bold text-[var(--chalk)] mt-1 leading-tight">{p.nombre}</h3>
                  </div>
                  {!p.activo && <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock-dim)] border border-[var(--ink-line)] px-2 py-0.5">Inactivo</span>}
                </div>

                <div>
                  <p className="font-mono tabular-nums text-3xl text-[var(--chalk)]">${p.precio.toLocaleString('es-AR')}</p>
                  <p className="text-xs text-[var(--rock)] mt-1">
                    {p.cantTickets} {p.cantTickets === 1 ? 'ticket' : 'tickets'}
                    {p.conZapas && ' · con zapas'}
                  </p>
                </div>

                {p.comprasCount !== undefined && p.comprasCount > 0 && (
                  <p className="text-[11px] text-[var(--rock-dim)]">
                    {p.comprasCount} {p.comprasCount === 1 ? 'compra' : 'compras'} asociadas
                  </p>
                )}

                <div className="flex items-center gap-1 pt-3 border-t border-[var(--ink-line)] mt-auto">
                  <button
                    onClick={() => toggleActivo(p)}
                    title={p.activo ? 'Desactivar' : 'Activar'}
                    className="flex-1 py-2 text-xs uppercase tracking-wide text-[var(--rock)] hover:text-[var(--chalk)] transition-colors"
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <div className="w-px h-6 bg-[var(--ink-line)]" />
                  <button
                    onClick={() => abrirEdit(p)}
                    className="flex-1 py-2 text-xs uppercase tracking-wide text-[var(--gold)] hover:brightness-125 transition-all"
                  >
                    Editar
                  </button>
                  <div className="w-px h-6 bg-[var(--ink-line)]" />
                  <button
                    onClick={() => eliminar(p)}
                    disabled={!puedeEliminar}
                    title={puedeEliminar ? 'Eliminar' : 'No se puede eliminar: tiene compras asociadas'}
                    className="flex-1 py-2 text-xs uppercase tracking-wide text-[var(--crit)] hover:brightness-125 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PlanModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={cargar} editing={editing} />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { HorarioModal } from '../components/HorarioModal';

type Horario = {
  id: string;
  diaSemana: number;
  hora: string;
  tipoClase: string;
  cupoMaximo: number;
  profesorId: string | null;
  profesorNombre: string | null;
  activo: boolean;
};

const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function HorariosPage() {
  const { token } = useAuth();
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Horario | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInactivos, setShowInactivos] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/horarios', {}, token);
      setHorarios(data.horarios ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleActivo(h: Horario) {
    await apiFetch(`/api/admin/horarios?id=${h.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: !h.activo }),
    }, token);
    cargar();
  }

  async function eliminar(h: Horario) {
    if (!confirm(`¿Eliminar el horario de ${DIAS_FULL[h.diaSemana - 1]} ${h.hora} — ${h.tipoClase}?\n\nSi tiene reservas asociadas se archivará en lugar de eliminarse.`)) return;
    await apiFetch(`/api/admin/horarios?id=${h.id}`, { method: 'DELETE' }, token);
    cargar();
  }

  function abrirNuevo() { setEditing(null); setModalOpen(true); }
  function abrirEdit(h: Horario) { setEditing(h); setModalOpen(true); }

  const visibles = showInactivos ? horarios : horarios.filter((h) => h.activo);
  const porDia = new Map<number, Horario[]>();
  for (const h of visibles) {
    if (!porDia.has(h.diaSemana)) porDia.set(h.diaSemana, []);
    porDia.get(h.diaSemana)!.push(h);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h2 className="font-['Anton'] uppercase text-2xl">Horarios</h2>
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
            className="flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-[var(--on-accent)] text-xs uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="square" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo horario
          </button>
        </div>
      </div>

      {loading && horarios.length === 0 && <p className="text-sm text-[var(--rock-dim)]">Cargando…</p>}

      {!loading && visibles.length === 0 && (
        <div className="border border-[var(--ink-line)] p-8 text-center rounded-md">
          <p className="text-[var(--rock)] mb-3">No hay horarios cargados todavía.</p>
          <button onClick={abrirNuevo} className="text-[var(--gold)] text-sm uppercase tracking-wide hover:underline">
            Crear el primero
          </button>
        </div>
      )}

      {visibles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
            const items = porDia.get(dia) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={dia} className="border border-[var(--ink-line)] rounded-md overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ink-line)] bg-[var(--ink-raised)]">
                  <p className="font-['Anton'] uppercase text-sm tracking-wide text-[var(--gold)]">{DIAS_FULL[dia - 1]}</p>
                </div>
                <ul>
                  {items.sort((a, b) => a.hora.localeCompare(b.hora)).map((h) => (
                    <li key={h.id} className={`border-t border-[var(--ink-line)] first:border-t-0 p-4 ${!h.activo ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono tabular-nums text-[var(--chalk)] text-sm">{h.hora}</p>
                          <p className="text-[var(--chalk)] text-sm mt-0.5">{h.tipoClase}</p>
                          <p className="text-[11px] text-[var(--rock)] mt-1">
                            {h.profesorNombre ?? 'Sin profesor'} · Cupo {h.cupoMaximo}
                            {!h.activo && ' · Inactivo'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleActivo(h)}
                            title={h.activo ? 'Desactivar' : 'Activar'}
                            className="p-1.5 text-[var(--rock)] hover:text-[var(--chalk)] transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              {h.activo ? (
                                <path strokeLinecap="square" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              ) : (
                                <path strokeLinecap="square" d="M5 13l4 4L19 7" />
                              )}
                            </svg>
                          </button>
                          <button
                            onClick={() => abrirEdit(h)}
                            title="Editar"
                            className="p-1.5 text-[var(--rock)] hover:text-[var(--gold)] transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="square" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => eliminar(h)}
                            title="Eliminar"
                            className="p-1.5 text-[var(--rock)] hover:text-[var(--crit)] transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="square" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <HorarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={cargar}
        editing={editing}
      />
    </div>
  );
}

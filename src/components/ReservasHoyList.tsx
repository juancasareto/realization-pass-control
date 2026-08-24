import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

type Reserva = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  fechaHora: string;
  tipoClase: string;
  estadoAsistencia: string;
};

type AlumnoInfo = { ticketsDisponibles: number; ultimaReserva: string | null };

function hoyIsoLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'var(--rock)' },
  PRESENTE: { label: 'Presente', color: 'var(--good)' },
  AVISO_AUSENCIA: { label: 'Aviso ausencia', color: 'var(--warn)' },
  PENALIZADA: { label: 'Penalizada', color: 'var(--crit)' },
  RECUPERADA: { label: 'Recuperada', color: 'var(--gold)' },
};

export function ReservasHoyList({ refreshKey, onSaved }: { refreshKey?: number; onSaved?: () => void }) {
  const { token } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState<Reserva | null>(null);
  const [infoAlumno, setInfoAlumno] = useState<AlumnoInfo | null>(null);
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/reservas?fecha=${hoyIsoLocal()}`, {}, token);
      setReservas(data.reservas ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  async function abrirConfirmacion(r: Reserva) {
    setConfirmando(r);
    setInfoAlumno(null);
    try {
      const data = await apiFetch(`/api/admin/clientes/${r.clienteId}`, {}, token);
      const reservasFuturas = (data.reservas ?? []).filter((x: any) => new Date(x.fechaHora) >= new Date());
      const ultima = reservasFuturas.length > 0
        ? reservasFuturas.reduce((max: any, x: any) => new Date(x.fechaHora) > new Date(max.fechaHora) ? x : max).fechaHora
        : null;
      setInfoAlumno({ ticketsDisponibles: data.cliente?.ticketsDisponibles ?? 0, ultimaReserva: ultima });
    } catch {
      setInfoAlumno({ ticketsDisponibles: 0, ultimaReserva: null });
    }
  }

  async function confirmarPresente() {
    if (!confirmando) return;
    setMarcando(true);
    try {
      await apiFetch(`/api/admin/reservas/${confirmando.id}/marcar`, {
        method: 'POST',
        body: JSON.stringify({ estado: 'PRESENTE' }),
      }, token);
      setConfirmando(null);
      await cargar();
      onSaved?.();
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="border border-[var(--ink-line)] rounded-md overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--ink-line)]">
        <p className="text-xs uppercase text-[var(--rock)]">Reservas de hoy</p>
        {loading && <span className="text-[10px] text-[var(--rock-dim)] uppercase">Cargando…</span>}
      </div>

      {reservas.length === 0 && !loading ? (
        <p className="p-4 text-sm text-[var(--rock-dim)]">Sin reservas para hoy.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {reservas.map((r) => {
              const estado = ESTADO_LABEL[r.estadoAsistencia] ?? { label: r.estadoAsistencia, color: 'var(--rock)' };
              const hora = new Date(r.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
              return (
                <tr key={r.id} className="border-t border-[var(--ink-line)]">
                  <td className="p-3 font-mono tabular-nums text-[var(--rock)] w-16">{hora}</td>
                  <td className="p-3">
                    <p className="text-[var(--chalk)]">{r.clienteNombre}</p>
                    <p className="text-[11px] text-[var(--rock-dim)]">{r.tipoClase}</p>
                  </td>
                  <td className="p-3 text-right">
                    {r.estadoAsistencia === 'PENDIENTE' ? (
                      <button
                        onClick={() => abrirConfirmacion(r)}
                        className="px-3 py-1.5 border border-[var(--good)] text-[var(--good)] text-xs uppercase tracking-wide hover:bg-[rgb(79_174_109/0.1)] transition-colors rounded-md"
                      >
                        Registrar
                      </button>
                    ) : (
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: estado.color }}>{estado.label}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmando(null); }}
        >
          <div className="bg-[var(--ink-raised)] border border-[var(--ink-line)] w-full max-w-sm p-5 shadow-xl rounded-md">
            <h3 className="font-['Anton'] uppercase text-lg tracking-wide text-[var(--chalk)] mb-3">Registrar asistencia</h3>
            <div className="space-y-2 text-sm mb-5">
              <p className="text-[var(--chalk)]">{confirmando.clienteNombre}</p>
              <p className="text-[var(--rock)]">{confirmando.tipoClase} — {new Date(confirmando.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
              {infoAlumno ? (
                <div className="border border-[var(--ink-line)] bg-[var(--ink)] p-3 space-y-1 rounded-md">
                  <p className="text-xs text-[var(--rock)]">
                    Clases pendientes: <span className="font-bold text-[var(--gold)]">{Math.max(0, infoAlumno.ticketsDisponibles - 1)}</span> tras esta
                  </p>
                  {infoAlumno.ultimaReserva && (
                    <p className="text-xs text-[var(--rock)]">
                      Última clase reservada: <span className="text-[var(--chalk)]">{new Date(infoAlumno.ultimaReserva).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--rock-dim)]">Cargando info…</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmando(null)} className="flex-1 py-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] text-sm uppercase tracking-wide transition-colors rounded-md">Cancelar</button>
              <button onClick={confirmarPresente} disabled={marcando} className="flex-1 py-2 bg-[var(--good)] text-white text-sm uppercase tracking-wide font-bold hover:brightness-110 transition-all disabled:opacity-50 rounded-md">{marcando ? '…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

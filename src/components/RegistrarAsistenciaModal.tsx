import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';
import { ComboboxAlumno, type AlumnoOption } from './ComboboxAlumno';

type ReservaHoy = { id: string; clienteId: string; fechaHora: string; tipoClase: string; estadoAsistencia: string };

type Props = { open: boolean; onClose: () => void; onSaved?: () => void };

function hoyIsoLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function RegistrarAsistenciaModal({ open, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [alumno, setAlumno] = useState<AlumnoOption | null>(null);
  const [reservaHoy, setReservaHoy] = useState<ReservaHoy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!alumno) { setReservaHoy(null); return; }
    apiFetch(`/api/admin/reservas?fecha=${hoyIsoLocal()}`, {}, token).then((data) => {
      const propia = (data.reservas ?? []).find((r: ReservaHoy) => r.clienteId === alumno.id && r.estadoAsistencia === 'PENDIENTE');
      setReservaHoy(propia ?? null);
    });
  }, [alumno, open, token]);

  function reset() { setAlumno(null); setReservaHoy(null); setError(null); }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alumno) { setError('Elegí un alumno.'); return; }

    setSaving(true);
    try {
      if (reservaHoy) {
        await apiFetch(`/api/admin/reservas/${reservaHoy.id}/marcar`, {
          method: 'POST',
          body: JSON.stringify({ estado: 'PRESENTE' }),
        }, token);
      } else {
        await apiFetch('/api/admin/reservas?accion=checkin_libre', {
          method: 'POST',
          body: JSON.stringify({ clienteId: alumno.id }),
        }, token);
      }
      onSaved?.();
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos registrar la asistencia.');
    } finally {
      setSaving(false);
    }
  }

  const ticketsInfo = alumno ? `${alumno.ticketsDisponibles} tickets disponibles` : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar asistencia"
      subtitle="Marca al alumno como presente. Si tiene reserva se usa; si no, se consume 1 ticket libre."
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors">Cancelar</button>
          <button type="submit" form="asistencia-form" disabled={saving || !alumno} className="flex-1 py-2.5 bg-[var(--good)] text-white text-sm uppercase tracking-wide font-bold hover:brightness-110 transition-all disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar asistencia'}</button>
        </div>
      }
    >
      <form id="asistencia-form" onSubmit={submit} className="space-y-4">
        <Field label="Alumno *">
          <ComboboxAlumno value={alumno} onChange={setAlumno} autoFocus />
        </Field>

        {alumno && (
          <div className="border border-[var(--ink-line)] bg-[var(--ink)] p-3 text-sm">
            <p className="text-[var(--rock)]">{ticketsInfo}</p>
            {reservaHoy ? (
              <p className="text-[var(--good)] mt-1">✓ Tiene reserva hoy — {reservaHoy.tipoClase} a las {new Date(reservaHoy.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
            ) : (
              <p className="text-[var(--warn)] mt-1">Sin reserva hoy — se consumirá 1 ticket libre.</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--rock)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

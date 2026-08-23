import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';
import { ComboboxAlumno, type AlumnoOption } from './ComboboxAlumno';

type ProximaReserva = { id: string; fechaHora: string; tipoClase: string };

type Props = { open: boolean; onClose: () => void; onSaved?: () => void };

function fetchProximaReservaAlumno(clienteId: string, token: string | null) {
  // Traemos las reservas de los próximos 7 días y buscamos la más próxima del alumno.
  const promesas: Promise<any>[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    promesas.push(apiFetch(`/api/admin/reservas?fecha=${iso}`, {}, token));
  }
  return Promise.all(promesas).then((results) => {
    const ahora = Date.now();
    const all = results.flatMap((r: any) => r.reservas ?? []);
    const propias = all
      .filter((r: any) => r.clienteId === clienteId && r.estadoAsistencia === 'PENDIENTE' && new Date(r.fechaHora).getTime() >= ahora)
      .sort((a: any, b: any) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
    return propias[0] ?? null;
  });
}

export function AvisoAusenciaModal({ open, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [alumno, setAlumno] = useState<AlumnoOption | null>(null);
  const [reserva, setReserva] = useState<ProximaReserva | null>(null);
  const [modo, setModo] = useState<'RECUPERO' | 'TICKET_EXTRA'>('RECUPERO');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!open || !alumno) { setReserva(null); return; }
    setBuscando(true);
    fetchProximaReservaAlumno(alumno.id, token)
      .then((r) => setReserva(r))
      .finally(() => setBuscando(false));
  }, [alumno, open, token]);

  function reset() { setAlumno(null); setReserva(null); setModo('RECUPERO'); setError(null); }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alumno) { setError('Elegí un alumno.'); return; }
    if (!reserva) { setError('El alumno no tiene una próxima reserva pendiente en los próximos 7 días.'); return; }

    setSaving(true);
    try {
      if (modo === 'RECUPERO') {
        await apiFetch(`/api/admin/reservas/${reserva.id}/marcar`, {
          method: 'POST',
          body: JSON.stringify({ estado: 'AVISO_AUSENCIA' }),
        }, token);
      } else {
        await apiFetch('/api/admin/reservas?accion=aviso_ticket_extra', {
          method: 'POST',
          body: JSON.stringify({ reservaId: reserva.id }),
        }, token);
      }
      onSaved?.();
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos registrar el aviso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Aviso de ausencia"
      subtitle="El alumno avisa que no va a poder venir a su próxima clase."
      size="lg"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors">Cancelar</button>
          <button type="submit" form="aviso-form" disabled={saving || !alumno || !reserva} className="flex-1 py-2.5 bg-[var(--warn)] text-white text-sm uppercase tracking-wide font-bold hover:brightness-110 transition-all disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar aviso'}</button>
        </div>
      }
    >
      <form id="aviso-form" onSubmit={submit} className="space-y-4">
        <Field label="Alumno *">
          <ComboboxAlumno value={alumno} onChange={setAlumno} autoFocus />
        </Field>

        {alumno && (
          <div className="border border-[var(--ink-line)] bg-[var(--ink)] p-3 text-sm">
            {buscando && <p className="text-[var(--rock)]">Buscando próxima clase…</p>}
            {!buscando && reserva && (
              <div>
                <p className="text-[var(--rock)] text-xs uppercase tracking-wide mb-1">Próxima clase</p>
                <p className="text-[var(--chalk)]">{reserva.tipoClase} — {new Date(reserva.fechaHora).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            {!buscando && !reserva && (
              <p className="text-[var(--warn)]">Sin próxima clase reservada en los próximos 7 días.</p>
            )}
          </div>
        )}

        {reserva && (
          <Field label="Modo *">
            <div className="grid grid-cols-2 gap-2">
              <ModoBtn
                active={modo === 'RECUPERO'}
                onClick={() => setModo('RECUPERO')}
                title="Recupero 7d"
                subtitle="Se reprograma automáticamente para la próxima clase del mismo horario."
              />
              <ModoBtn
                active={modo === 'TICKET_EXTRA'}
                onClick={() => setModo('TICKET_EXTRA')}
                title="Ticket extra"
                subtitle="No reprograma. Suma 1 ticket disponible al final del período."
              />
            </div>
          </Field>
        )}

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

function ModoBtn({ active, onClick, title, subtitle }: { active: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 border transition-colors ${
        active
          ? 'border-[var(--warn)] bg-[rgb(217_123_41/0.1)]'
          : 'border-[var(--ink-line)] hover:border-[var(--rock)]'
      }`}
    >
      <p className={`text-sm uppercase tracking-wide font-bold ${active ? 'text-[var(--warn)]' : 'text-[var(--chalk)]'}`}>{title}</p>
      <p className="text-[11px] text-[var(--rock)] mt-1 leading-snug">{subtitle}</p>
    </button>
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

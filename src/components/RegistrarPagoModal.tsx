import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';
import { ComboboxAlumno, type AlumnoOption } from './ComboboxAlumno';

type Modalidad = { id: string; nombre: string; tipo: 'LIBRE' | 'CLASES'; precio: number; cantTickets: number; activo: boolean };
type Horario = { id: string; diaSemana: number; hora: string; tipoClase: string; profesorNombre: string | null; activo: boolean };

const MEDIOS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
];

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type Props = { open: boolean; onClose: () => void; onSaved?: () => void };

export function RegistrarPagoModal({ open, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [alumno, setAlumno] = useState<AlumnoOption | null>(null);
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [modalidadId, setModalidadId] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [medio, setMedio] = useState('EFECTIVO');
  const [pagoTotal, setPagoTotal] = useState(true);
  const [montoParcial, setMontoParcial] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch('/api/admin/modalidades', {}, token),
      apiFetch('/api/admin/horarios', {}, token),
    ]).then(([m, h]) => {
      setModalidades((m.modalidades ?? []).filter((x: Modalidad) => x.activo));
      setHorarios((h.horarios ?? []).filter((x: Horario) => x.activo));
    });
  }, [open, token]);

  const modalidad = modalidades.find((m) => m.id === modalidadId) ?? null;
  const precio = modalidad ? Number(modalidad.precio) : 0;
  const monto = pagoTotal ? precio : Number(montoParcial || 0);
  const descuentoPct = pagoTotal || precio === 0 ? 0 : Math.max(0, Math.min(100, ((precio - monto) / precio) * 100));

  function reset() {
    setAlumno(null); setModalidadId(''); setHorarioId(''); setMedio('EFECTIVO');
    setPagoTotal(true); setMontoParcial(''); setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!alumno) { setError('Elegí un alumno.'); return; }
    if (!modalidad) { setError('Elegí un plan.'); return; }
    if (modalidad.tipo === 'CLASES' && !horarioId) { setError('Para un plan de Clases, elegí el horario fijo.'); return; }
    if (!pagoTotal && (monto <= 0 || monto > precio)) { setError('Monto parcial inválido.'); return; }

    setSaving(true);
    try {
      await apiFetch('/api/admin/compras', {
        method: 'POST',
        body: JSON.stringify({
          clienteId: alumno.id,
          modalidadId,
          medio,
          descuentoAplicado: Math.round(descuentoPct * 100) / 100,
          horarioId: modalidad.tipo === 'CLASES' ? horarioId : undefined,
        }),
      }, token);
      onSaved?.();
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos registrar el pago.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar pago"
      subtitle="Vende un plan y registra el pago en el mismo paso."
      size="lg"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors">Cancelar</button>
          <button type="submit" form="pago-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar pago'}</button>
        </div>
      }
    >
      <form id="pago-form" onSubmit={submit} className="space-y-4">
        <Field label="Alumno *">
          <ComboboxAlumno value={alumno} onChange={setAlumno} autoFocus />
        </Field>

        <Field label="Plan *">
          <select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)} className={inputClass}>
            <option value="">Elegí un plan…</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} — {m.cantTickets} clases — ${Number(m.precio).toLocaleString('es-AR')}
              </option>
            ))}
          </select>
        </Field>

        {modalidad?.tipo === 'CLASES' && (
          <Field label="Horario fijo *">
            <select value={horarioId} onChange={(e) => setHorarioId(e.target.value)} className={inputClass}>
              <option value="">Elegí el horario…</option>
              {horarios.map((h) => (
                <option key={h.id} value={h.id}>
                  {DIAS[h.diaSemana - 1]} {h.hora} · {h.tipoClase}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Medio de pago *">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputClass}>
              {MEDIOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Monto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagoTotal(!pagoTotal)}
                className={`px-3 py-2.5 border text-xs uppercase tracking-wide transition-colors ${
                  pagoTotal ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--ink-line)] text-[var(--rock)]'
                }`}
              >
                {pagoTotal ? 'Total' : 'Parcial'}
              </button>
              {pagoTotal ? (
                <div className={`${inputClass} font-mono tabular-nums`}>${precio.toLocaleString('es-AR')}</div>
              ) : (
                <input type="number" value={montoParcial} onChange={(e) => setMontoParcial(e.target.value)} placeholder="0" className={`${inputClass} font-mono tabular-nums`} />
              )}
            </div>
          </Field>
        </div>

        {!pagoTotal && descuentoPct > 0 && (
          <p className="text-xs text-[var(--rock)]">
            Descuento aplicado: <span className="text-[var(--gold)] font-bold">{descuentoPct.toFixed(1)}%</span>
          </p>
        )}

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

const inputClass = 'w-full bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none focus:border-[var(--gold)] transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--rock)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

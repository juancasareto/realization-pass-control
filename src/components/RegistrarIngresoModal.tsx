import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';
import { CATEGORIAS_INGRESO, MEDIOS } from '../lib/contable';

type Props = { open: boolean; onClose: () => void; onSaved?: () => void };

export function RegistrarIngresoModal({ open, onClose, onSaved }: Props) {
  const { token } = useAuth();
  const [categoria, setCategoria] = useState('DIA_SUELTO');
  const [medio, setMedio] = useState('EFECTIVO');
  const [monto, setMonto] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategoria('DIA_SUELTO'); setMedio('EFECTIVO'); setMonto(''); setDescripcion(''); setError(null);
  }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) { setError('Ingresá un monto válido.'); return; }

    setSaving(true);
    try {
      await apiFetch('/api/admin/cobros?accion=ingreso', {
        method: 'POST',
        body: JSON.stringify({
          categoria, medio, monto: montoNum,
          descripcion: descripcion.trim() || undefined,
        }),
      }, token);
      onSaved?.();
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos registrar el ingreso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar ingreso"
      subtitle="Para ingresos que no vienen de la venta de un plan (día suelto, alquiler de muro, otros)."
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors">Cancelar</button>
          <button type="submit" form="ingreso-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--good)] text-white text-sm uppercase tracking-wide font-bold hover:brightness-110 transition-all disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar ingreso'}</button>
        </div>
      }
    >
      <form id="ingreso-form" onSubmit={submit} className="space-y-4">
        <Field label="Categoría *">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputClass}>
            {CATEGORIAS_INGRESO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Medio de pago *">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputClass}>
              {MEDIOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Monto *">
            <div className="flex">
              <span className="px-3 py-2.5 bg-[var(--ink)] border border-r-0 border-[var(--ink-line)] text-[var(--rock)] text-sm">$</span>
              <input type="number" min={0} step={100} value={monto} onChange={(e) => setMonto(e.target.value === '' ? '' : Number(e.target.value))} className={`${inputClass} font-mono tabular-nums`} placeholder="0" autoFocus />
            </div>
          </Field>
        </div>

        <Field label="Descripción">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} placeholder="Opcional (ej: Juan Pérez, muro martes)" />
        </Field>

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

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';

export type Plan = {
  id: string;
  nombre: string;
  tipo: 'LIBRE' | 'CLASES';
  conZapas: boolean;
  cantTickets: number;
  precio: number;
  activo: boolean;
  comprasCount?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editing?: Plan | null;
};

export function PlanModal({ open, onClose, onSaved, editing }: Props) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'LIBRE' | 'CLASES'>('CLASES');
  const [conZapas, setConZapas] = useState(false);
  const [cantTickets, setCantTickets] = useState(4);
  const [precio, setPrecio] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre);
      setTipo(editing.tipo);
      setConZapas(editing.conZapas);
      setCantTickets(editing.cantTickets);
      setPrecio(Number(editing.precio));
    } else {
      setNombre('');
      setTipo('CLASES');
      setConZapas(false);
      setCantTickets(4);
      setPrecio(0);
    }
    setError(null);
  }, [open, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (cantTickets < 1) { setError('La cantidad de tickets debe ser ≥ 1.'); return; }
    if (precio < 0) { setError('El precio debe ser ≥ 0.'); return; }

    setSaving(true);
    try {
      if (isEdit && editing) {
        await apiFetch(`/api/admin/modalidades?id=${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre: nombre.trim(), tipo, conZapas, cantTickets, precio }),
        }, token);
      } else {
        await apiFetch('/api/admin/modalidades', {
          method: 'POST',
          body: JSON.stringify({ nombre: nombre.trim(), tipo, conZapas, cantTickets, precio }),
        }, token);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos guardar el plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar plan' : 'Nuevo plan'}
      size="md"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors rounded-md">Cancelar</button>
          <button type="submit" form="plan-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-50 rounded-md">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear plan'}</button>
        </div>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre *">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Ej: 4 clases al mes" autoFocus />
        </Field>

        <Field label="Tipo *">
          <div className="grid grid-cols-2 gap-2">
            <TipoBtn
              active={tipo === 'CLASES'}
              onClick={() => setTipo('CLASES')}
              title="Clases"
              subtitle="Horario fijo semanal, reservas automáticas."
            />
            <TipoBtn
              active={tipo === 'LIBRE'}
              onClick={() => setTipo('LIBRE')}
              title="Libre"
              subtitle="Sin horario fijo. Se usan tickets cuando venga."
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cantidad de tickets *">
            <input type="number" min={1} value={cantTickets} onChange={(e) => setCantTickets(Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Precio *">
            <div className="flex">
              <span className="px-3 py-2.5 bg-[var(--ink)] border border-r-0 border-[var(--ink-line)] text-[var(--rock)] text-sm">$</span>
              <input type="number" min={0} step={100} value={precio} onChange={(e) => setPrecio(Number(e.target.value))} className={`${inputClass} font-mono tabular-nums`} />
            </div>
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={conZapas} onChange={(e) => setConZapas(e.target.checked)} className="accent-[var(--gold)]" />
          <span className="text-sm text-[var(--chalk)]">Incluye alquiler de zapatillas</span>
        </label>

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

const inputClass = 'w-full bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none focus:border-[var(--gold)] transition-colors rounded-md';

function TipoBtn({ active, onClick, title, subtitle }: { active: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 border transition-colors ${
        active ? 'border-[var(--gold)] bg-[rgb(241_180_0/0.08)]' : 'border-[var(--ink-line)] hover:border-[var(--rock)]'
      }`}
    >
      <p className={`text-sm uppercase tracking-wide font-bold ${active ? 'text-[var(--gold)]' : 'text-[var(--chalk)]'}`}>{title}</p>
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

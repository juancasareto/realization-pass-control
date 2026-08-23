import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';

type Props = { open: boolean; onClose: () => void; onCreated?: (id: string) => void };

export function NuevoAlumnoModal({ open, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() { setNombre(''); setEmail(''); setTelefono(''); setError(null); }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !email.trim()) { setError('Nombre y email son obligatorios.'); return; }
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/clientes', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() || undefined }),
      }, token);
      onCreated?.(res.cliente.id);
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos crear el alumno.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo alumno"
      subtitle="Cargá los datos básicos. La ficha completa se edita después."
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors">Cancelar</button>
          <button type="submit" form="nuevo-alumno-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-50">{saving ? 'Guardando…' : 'Crear alumno'}</button>
        </div>
      }
    >
      <form id="nuevo-alumno-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo *">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <Field label="Email *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Teléfono">
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} placeholder="+54 11 ..." />
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

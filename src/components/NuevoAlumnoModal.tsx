import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';

type Props = { open: boolean; onClose: () => void; onCreated?: (id: string) => void };

type Form = {
  nombre: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  dni: string;
  direccion: string;
  contactoEmergenciaNombre: string;
  contactoEmergenciaTel: string;
};

const EMPTY: Form = {
  nombre: '', email: '', telefono: '', fechaNacimiento: '', dni: '', direccion: '',
  contactoEmergenciaNombre: '', contactoEmergenciaTel: '',
};

export function NuevoAlumnoModal({ open, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd<K extends keyof Form>(key: K, value: Form[K]) { setForm((f) => ({ ...f, [key]: value })); }
  function reset() { setForm(EMPTY); setError(null); }
  function handleClose() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.email.trim()) { setError('Nombre y email son obligatorios.'); return; }

    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim() || undefined,
          fechaNacimiento: form.fechaNacimiento || undefined,
          dni: form.dni.trim() || undefined,
          direccion: form.direccion.trim() || undefined,
          contactoEmergenciaNombre: form.contactoEmergenciaNombre.trim() || undefined,
          contactoEmergenciaTel: form.contactoEmergenciaTel.trim() || undefined,
        }),
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
      subtitle="Los alumnos deben estar registrados para reservar o alquilar el muro."
      size="lg"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors rounded-md">Cancelar</button>
          <button type="submit" form="nuevo-alumno-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-50 rounded-md">{saving ? 'Guardando…' : 'Crear alumno'}</button>
        </div>
      }
    >
      <form id="nuevo-alumno-form" onSubmit={submit} className="space-y-4">
        <SectionLabel>Datos principales</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre completo *">
            <input value={form.nombre} onChange={(e) => upd('nombre', e.target.value)} className={inputClass} autoFocus />
          </Field>
          <Field label="Email *">
            <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Teléfono">
            <input value={form.telefono} onChange={(e) => upd('telefono', e.target.value)} className={inputClass} placeholder="+54 11 ..." />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" value={form.fechaNacimiento} onChange={(e) => upd('fechaNacimiento', e.target.value)} className={inputClass} />
          </Field>
          <Field label="DNI">
            <input value={form.dni} onChange={(e) => upd('dni', e.target.value)} className={inputClass} placeholder="Sin puntos" />
          </Field>
          <Field label="Dirección">
            <input value={form.direccion} onChange={(e) => upd('direccion', e.target.value)} className={inputClass} placeholder="Calle 123, CABA" />
          </Field>
        </div>

        <SectionLabel>Contacto de emergencia</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre">
            <input value={form.contactoEmergenciaNombre} onChange={(e) => upd('contactoEmergenciaNombre', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Teléfono">
            <input value={form.contactoEmergenciaTel} onChange={(e) => upd('contactoEmergenciaTel', e.target.value)} className={inputClass} placeholder="+54 11 ..." />
          </Field>
        </div>

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

const inputClass = 'w-full bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none focus:border-[var(--gold)] transition-colors rounded-md';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--rock-dim)] border-b border-[var(--ink-line)] pb-2">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--rock)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

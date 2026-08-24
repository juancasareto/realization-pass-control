import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';
import { EstadoBadge } from './EstadoBadge';

type Cliente = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  fotoUrl: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  dni: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTel: string | null;
  ticketsDisponibles: number;
  vencimiento: string | null;
  planActual: string | null;
  estado: string;
  clienteDesde: string;
  ausenciasSinAviso: number;
  ultimaVisita: string | null;
  rachaAsistencias: number;
};

type Props = {
  clienteId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toDateInput(d: string | null) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export function FichaAlumnoModal({ clienteId, open, onClose, onUpdated }: Props) {
  const { token } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clienteId) return;
    setLoading(true);
    setModo('view');
    setError(null);
    apiFetch(`/api/admin/clientes/${clienteId}`, {}, token)
      .then((data) => setCliente(data.cliente))
      .finally(() => setLoading(false));
  }, [clienteId, open, token]);

  function entrarEdicion() {
    if (!cliente) return;
    setForm({
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono ?? '',
      fechaNacimiento: cliente.fechaNacimiento,
      dni: cliente.dni ?? '',
      direccion: cliente.direccion ?? '',
      contactoEmergenciaNombre: cliente.contactoEmergenciaNombre ?? '',
      contactoEmergenciaTel: cliente.contactoEmergenciaTel ?? '',
    });
    setError(null);
    setModo('edit');
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        fechaNacimiento: form.fechaNacimiento ? new Date(form.fechaNacimiento).toISOString() : null,
      };
      const res = await apiFetch(`/api/admin/clientes/${cliente.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }, token);
      setCliente((prev) => prev ? { ...prev, ...res.cliente } : prev);
      setModo('view');
      onUpdated?.();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  const title = modo === 'edit' ? 'Editar alumno' : 'Ficha de alumno';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        !cliente ? null : modo === 'view' ? (
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] text-sm uppercase tracking-wide transition-colors rounded-md">Cerrar</button>
            <button onClick={entrarEdicion} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors rounded-md">Editar</button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setModo('view')} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] text-sm uppercase tracking-wide transition-colors rounded-md">Cancelar</button>
            <button type="submit" form="editar-alumno-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--ink)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors rounded-md disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        )
      }
    >
      {loading && <p className="text-sm text-[var(--rock)]">Cargando…</p>}

      {cliente && modo === 'view' && (
        <div className="space-y-5">
          {/* Header con avatar + estado */}
          <div className="flex items-start gap-4">
            {cliente.fotoUrl ? (
              <img src={cliente.fotoUrl} alt={cliente.nombre} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--gold)] text-[var(--ink)] flex items-center justify-center text-xl font-bold font-['JetBrains_Mono'] shrink-0">
                {getInitials(cliente.nombre)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-[var(--chalk)] truncate">{cliente.nombre}</h3>
              <p className="text-sm text-[var(--rock)] truncate">{cliente.email}</p>
              <div className="mt-2"><EstadoBadge estado={cliente.estado} /></div>
            </div>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Clases restantes" value={String(cliente.ticketsDisponibles)} />
            <Metric label="Racha" value={cliente.rachaAsistencias > 0 ? `${cliente.rachaAsistencias} 🔥` : '—'} />
            <Metric label="Ausencias" value={String(cliente.ausenciasSinAviso)} />
          </div>

          {/* Datos personales */}
          <Section title="Datos personales">
            <InfoRow label="Teléfono" value={cliente.telefono ?? '—'} />
            <InfoRow label="DNI" value={cliente.dni ?? '—'} />
            <InfoRow label="Fecha nacimiento" value={fmtDate(cliente.fechaNacimiento)} />
            <InfoRow label="Dirección" value={cliente.direccion ?? '—'} />
          </Section>

          {/* Contacto emergencia */}
          <Section title="Contacto de emergencia">
            <InfoRow label="Nombre" value={cliente.contactoEmergenciaNombre ?? '—'} />
            <InfoRow label="Teléfono" value={cliente.contactoEmergenciaTel ?? '—'} />
          </Section>

          {/* Plan */}
          <Section title="Plan">
            <InfoRow label="Plan actual" value={cliente.planActual ?? '—'} />
            <InfoRow label="Vencimiento" value={fmtDate(cliente.vencimiento)} />
          </Section>

          {/* Actividad */}
          <Section title="Actividad">
            <InfoRow label="Última visita" value={cliente.ultimaVisita ? fmtDate(cliente.ultimaVisita) : 'Nunca'} />
            <InfoRow label="Alumno desde" value={fmtDate(cliente.clienteDesde)} />
          </Section>
        </div>
      )}

      {cliente && modo === 'edit' && (
        <form id="editar-alumno-form" onSubmit={guardar} className="space-y-4">
          <SectionLabel>Datos principales</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre completo *">
              <input value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Fecha de nacimiento">
              <input type="date" value={toDateInput(form.fechaNacimiento ?? null)} onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })} className={inputClass} />
            </Field>
            <Field label="DNI">
              <input value={form.dni ?? ''} onChange={(e) => setForm({ ...form, dni: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Dirección">
              <input value={form.direccion ?? ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={inputClass} />
            </Field>
          </div>

          <SectionLabel>Contacto de emergencia</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre">
              <input value={form.contactoEmergenciaNombre ?? ''} onChange={(e) => setForm({ ...form, contactoEmergenciaNombre: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Teléfono">
              <input value={form.contactoEmergenciaTel ?? ''} onChange={(e) => setForm({ ...form, contactoEmergenciaTel: e.target.value })} className={inputClass} />
            </Field>
          </div>

          {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
        </form>
      )}
    </Modal>
  );
}

const inputClass = 'w-full bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none focus:border-[var(--gold)] transition-colors rounded-md';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink)] p-3 rounded-md">
      <p className="font-mono tabular-nums text-2xl text-[var(--chalk)]">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock)] mt-1">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--rock-dim)] border-b border-[var(--ink-line)] pb-2 mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-[var(--rock)]">{label}</span>
      <span className="text-[var(--chalk)] text-right truncate">{value}</span>
    </div>
  );
}

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

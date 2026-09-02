import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';

type Horario = {
  id: string;
  diaSemana: number;
  hora: string;
  tipoClase: string;
  cupoMaximo: number;
  profesorId: string | null;
  activo: boolean;
};

type Profesor = { id: string; nombre: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editing?: Horario | null;
};

const DIAS_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function HorarioModal({ open, onClose, onSaved, editing }: Props) {
  const { token } = useAuth();
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [dias, setDias] = useState<Set<number>>(new Set());
  const [hora, setHora] = useState('19:00');
  const [tipoClase, setTipoClase] = useState('');
  const [cupoMaximo, setCupoMaximo] = useState<number>(40);
  const [profesorId, setProfesorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    apiFetch('/api/admin/horarios?resource=profesores', {}, token).then((data) => setProfesores(data.profesores ?? []));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDias(new Set([editing.diaSemana]));
      setHora(editing.hora);
      setTipoClase(editing.tipoClase);
      setCupoMaximo(editing.cupoMaximo);
      setProfesorId(editing.profesorId ?? '');
    } else {
      setDias(new Set());
      setHora('19:00');
      setTipoClase('');
      setCupoMaximo(40);
      setProfesorId('');
    }
    setError(null);
  }, [open, editing]);

  function toggleDia(dia: number) {
    setDias((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia); else next.add(dia);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (dias.size === 0) { setError('Elegí al menos un día.'); return; }
    if (!tipoClase.trim()) { setError('El tipo de clase es obligatorio.'); return; }
    if (!hora) { setError('La hora es obligatoria.'); return; }
    if (cupoMaximo < 1) { setError('El cupo debe ser al menos 1.'); return; }

    setSaving(true);
    try {
      if (isEdit && editing) {
        await apiFetch(`/api/admin/horarios?id=${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            diaSemana: Array.from(dias)[0],
            hora, tipoClase: tipoClase.trim(), cupoMaximo,
            profesorId: profesorId || null,
          }),
        }, token);
      } else {
        await apiFetch('/api/admin/horarios', {
          method: 'POST',
          body: JSON.stringify({
            dias: Array.from(dias).sort((a, b) => a - b),
            hora, tipoClase: tipoClase.trim(), cupoMaximo,
            profesorId: profesorId || undefined,
          }),
        }, token);
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos guardar el horario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar horario' : 'Nuevo horario'}
      subtitle={isEdit ? undefined : 'Podés seleccionar varios días para crear todos de una vez.'}
      size="lg"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors rounded-md">Cancelar</button>
          <button type="submit" form="horario-form" disabled={saving} className="flex-1 py-2.5 bg-[var(--gold)] text-[var(--on-accent)] text-sm uppercase tracking-wide font-bold hover:bg-[var(--gold-soft)] transition-colors disabled:opacity-50 rounded-md">{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : `Crear ${dias.size > 1 ? `${dias.size} horarios` : 'horario'}`}</button>
        </div>
      }
    >
      <form id="horario-form" onSubmit={submit} className="space-y-5">
        <Field label={isEdit ? 'Día' : 'Días *'}>
          <div className="flex gap-2 flex-wrap">
            {DIAS_LABELS.map((label, i) => {
              const dia = i + 1;
              const active = dias.has(dia);
              const disabled = isEdit && !active;
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => !isEdit ? toggleDia(dia) : setDias(new Set([dia]))}
                  disabled={disabled && !isEdit}
                  title={DIAS_FULL[i]}
                  className={`w-11 h-11 border font-bold font-['JetBrains_Mono'] text-sm transition-colors ${
                    active
                      ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--on-accent)]'
                      : 'border-[var(--ink-line)] text-[var(--rock)] hover:border-[var(--rock)] hover:text-[var(--chalk)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!isEdit && dias.size > 0 && (
            <p className="text-[11px] text-[var(--rock)] mt-2">
              {Array.from(dias).sort((a, b) => a - b).map((d) => DIAS_FULL[d - 1]).join(', ')}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Hora *">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Cupo máximo *">
            <input type="number" min={1} value={cupoMaximo} onChange={(e) => setCupoMaximo(Number(e.target.value))} className={inputClass} />
          </Field>
        </div>

        <Field label="Tipo de clase *">
          <input
            value={tipoClase}
            onChange={(e) => setTipoClase(e.target.value)}
            className={inputClass}
            placeholder="Ej: Boulder intermedio"
          />
        </Field>

        <Field label="Profesor">
          <select value={profesorId} onChange={(e) => setProfesorId(e.target.value)} className={inputClass}>
            <option value="">Sin profesor asignado</option>
            {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>

        {error && <p className="text-sm text-[var(--crit)]">{error}</p>}
      </form>
    </Modal>
  );
}

const inputClass = 'w-full bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none focus:border-[var(--gold)] transition-colors rounded-md';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--rock)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

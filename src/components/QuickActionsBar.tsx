import { useState } from 'react';
import { NuevoAlumnoModal } from './NuevoAlumnoModal';
import { RegistrarPagoModal } from './RegistrarPagoModal';
import { RegistrarAsistenciaModal } from './RegistrarAsistenciaModal';
import { AvisoAusenciaModal } from './AvisoAusenciaModal';

type Props = { onSaved?: () => void };

type Accion = 'pago' | 'asistencia' | 'aviso' | 'nuevo';

const ACCIONES: { key: Accion; label: string; icon: string; color: string }[] = [
  { key: 'pago', label: 'Registrar pago', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'var(--gold)' },
  { key: 'asistencia', label: 'Registrar asistencia', icon: 'M5 13l4 4L19 7', color: 'var(--good)' },
  { key: 'aviso', label: 'Aviso de ausencia', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'var(--warn)' },
  { key: 'nuevo', label: 'Nuevo alumno', icon: 'M12 4v16m8-8H4', color: 'var(--chalk)' },
];

export function QuickActionsBar({ onSaved }: Props) {
  const [abierto, setAbierto] = useState<Accion | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {ACCIONES.map((a) => (
          <button
            key={a.key}
            onClick={() => setAbierto(a.key)}
            className="flex items-center gap-3 border border-[var(--ink-line)] bg-[var(--ink-raised)] hover:border-[var(--rock)] hover:bg-[rgb(255_255_255/0.03)] p-4 text-left transition-colors group rounded-md"
          >
            <div
              className="w-10 h-10 flex items-center justify-center border shrink-0 rounded-md"
              style={{ borderColor: a.color }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={a.color} strokeWidth={1.5}>
                <path strokeLinecap="square" strokeLinejoin="miter" d={a.icon} />
              </svg>
            </div>
            <span className="text-sm uppercase tracking-wide text-[var(--chalk)] leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <RegistrarPagoModal
        open={abierto === 'pago'}
        onClose={() => setAbierto(null)}
        onSaved={onSaved}
      />
      <RegistrarAsistenciaModal
        open={abierto === 'asistencia'}
        onClose={() => setAbierto(null)}
        onSaved={onSaved}
      />
      <AvisoAusenciaModal
        open={abierto === 'aviso'}
        onClose={() => setAbierto(null)}
        onSaved={onSaved}
      />
      <NuevoAlumnoModal
        open={abierto === 'nuevo'}
        onClose={() => setAbierto(null)}
        onCreated={onSaved}
      />
    </>
  );
}

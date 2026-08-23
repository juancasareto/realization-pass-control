import { useAuth } from '../lib/AuthContext';
import { Modal } from './Modal';

const ROL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESOR: 'Profesor',
};

export function MiPerfilModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { nombre, email, rol, logout } = useAuth();

  const initials = (nombre ?? '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const rolLabel = rol ? (ROL_LABEL[rol] ?? rol) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mi perfil"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-sm uppercase tracking-wide transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => { onClose(); logout(); }}
            className="flex-1 py-2.5 bg-[var(--crit)] text-white text-sm uppercase tracking-wide font-medium hover:brightness-110 transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-4 pb-4 border-b border-[var(--ink-line)]">
        <div className="w-14 h-14 rounded-full bg-[var(--gold)] text-[var(--ink)] flex items-center justify-center text-lg font-bold font-['JetBrains_Mono'] shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-base text-[var(--chalk)] truncate">{nombre}</p>
          <p className="text-sm text-[var(--rock)] truncate">{email}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] mt-1">{rolLabel}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <p className="text-[var(--rock)]">La edición de perfil y el cambio de contraseña se van a habilitar próximamente.</p>
      </div>
    </Modal>
  );
}

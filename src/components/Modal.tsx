import { useEffect, type ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-[var(--ink-raised)] border border-[var(--ink-line)] w-full ${maxWidth} max-h-[90vh] flex flex-col shadow-xl rounded-md overflow-hidden`}>
        <header className="flex items-start justify-between p-5 border-b border-[var(--ink-line)] shrink-0">
          <div>
            <h2 className="font-['Anton'] uppercase text-lg tracking-wide text-[var(--chalk)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--rock)] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--rock)] hover:text-[var(--chalk)] transition-colors -mr-1 -mt-1 p-1"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="p-5 border-t border-[var(--ink-line)] shrink-0">{footer}</footer>}
      </div>
    </div>
  );
}

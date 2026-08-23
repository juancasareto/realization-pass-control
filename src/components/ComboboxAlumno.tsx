import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

export type AlumnoOption = {
  id: string;
  nombre: string;
  email: string;
  ticketsDisponibles: number;
  estado: string;
  vencimiento: string | null;
};

type Props = {
  value: AlumnoOption | null;
  onChange: (a: AlumnoOption | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function ComboboxAlumno({ value, onChange, placeholder = 'Buscar alumno…', autoFocus }: Props) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiFetch('/api/admin/clientes', {}, token).then((data) => {
      if (!cancel) { setAlumnos(data.clientes ?? []); setLoading(false); }
    }).catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [token]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const filtered = query.trim() === ''
    ? alumnos
    : alumnos.filter((a) =>
        a.nombre.toLowerCase().includes(query.toLowerCase()) ||
        a.email.toLowerCase().includes(query.toLowerCase())
      );

  const shown = value && !open ? value.nombre : query;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center border border-[var(--ink-line)] bg-[var(--ink)] focus-within:border-[var(--gold)] transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={shown}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--chalk)] placeholder:text-[var(--rock-dim)] outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); inputRef.current?.focus(); }}
            className="text-[var(--rock)] hover:text-[var(--chalk)] px-2"
            aria-label="Limpiar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[var(--rock)] hover:text-[var(--chalk)] px-2"
          aria-label="Abrir"
        >
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[var(--ink-raised)] border border-[var(--ink-line)] max-h-52 overflow-y-auto shadow-xl">
          {loading && <div className="px-3 py-2.5 text-sm text-[var(--rock-dim)]">Cargando…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-[var(--rock-dim)]">Sin resultados.</div>
          )}
          {!loading && filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { onChange(a); setQuery(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 hover:bg-[rgb(255_255_255/0.05)] transition-colors ${
                value?.id === a.id ? 'bg-[rgb(255_255_255/0.05)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--chalk)] truncate">{a.nombre}</span>
                <span className="text-[11px] font-mono tabular-nums text-[var(--rock)] shrink-0">{a.ticketsDisponibles} tickets</span>
              </div>
              <p className="text-[11px] text-[var(--rock-dim)] truncate">{a.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

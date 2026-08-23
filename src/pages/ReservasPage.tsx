import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { ReservaCelda, type Celda, type CeldaReserva } from '../components/ReservaCelda';
import { AsistenciaBadge } from '../components/AsistenciaBadge';

type Reserva = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  fechaHora: string;
  tipoClase: string;
  estadoAsistencia: string;
  horarioId: string | null;
  cupoMaximo: number | null;
  profesorNombre: string | null;
};

type Profesor = { id: string; nombre: string };

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function inicioSemanaLunes(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // 0 = Lunes
  const inicio = new Date(d);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - dow);
  return inicio;
}

function fmtIsoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtRango(desde: Date, hasta: Date): string {
  const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${desde.toLocaleDateString('es-AR', opt)} — ${hasta.toLocaleDateString('es-AR', opt)}`;
}

export function ReservasPage() {
  const { token } = useAuth();
  const [inicioSemana, setInicioSemana] = useState(() => inicioSemanaLunes(new Date()));
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroProfesorId, setFiltroProfesorId] = useState('');
  const [celdaAbierta, setCeldaAbierta] = useState<Celda | null>(null);
  const [loading, setLoading] = useState(false);

  const finSemana = useMemo(() => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + 6);
    return d;
  }, [inicioSemana]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ desde: fmtIsoDia(inicioSemana), hasta: fmtIsoDia(finSemana) });
      if (filtroTipo) params.set('tipoClase', filtroTipo);
      if (filtroProfesorId) params.set('profesorId', filtroProfesorId);
      const [r, p] = await Promise.all([
        apiFetch(`/api/admin/reservas?${params.toString()}`, {}, token),
        profesores.length === 0 ? apiFetch('/api/admin/horarios?resource=profesores', {}, token) : Promise.resolve({ profesores }),
      ]);
      setReservas(r.reservas ?? []);
      if (profesores.length === 0) setProfesores(p.profesores ?? []);
    } finally {
      setLoading(false);
    }
  }, [inicioSemana, finSemana, filtroTipo, filtroProfesorId, token, profesores]);

  useEffect(() => { cargar(); }, [cargar]);

  const tiposClase = useMemo(() => {
    return Array.from(new Set(reservas.map((r) => r.tipoClase))).sort();
  }, [reservas]);

  // Construir celdas por día × (hora + tipoClase)
  const celdasPorDia = useMemo(() => {
    const porDia: Celda[][] = Array.from({ length: 7 }, () => []);
    const mapa = new Map<string, Celda>();

    for (const r of reservas) {
      const fecha = new Date(r.fechaHora);
      const diaIdx = Math.floor((fecha.getTime() - inicioSemana.getTime()) / 86400000);
      if (diaIdx < 0 || diaIdx > 6) continue;
      const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const key = `${diaIdx}-${hora}-${r.tipoClase}`;
      let celda = mapa.get(key);
      if (!celda) {
        celda = {
          key,
          fecha,
          tipoClase: r.tipoClase,
          hora,
          horarioId: r.horarioId,
          cupoMaximo: r.cupoMaximo,
          profesorNombre: r.profesorNombre,
          reservas: [],
        };
        mapa.set(key, celda);
        porDia[diaIdx].push(celda);
      }
      celda.reservas.push({ id: r.id, clienteId: r.clienteId, clienteNombre: r.clienteNombre, estadoAsistencia: r.estadoAsistencia });
    }

    for (const dia of porDia) {
      dia.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    return porDia;
  }, [reservas, inicioSemana]);

  function moverSemana(dias: number) {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + dias);
    setInicioSemana(d);
  }

  async function marcarReserva(reservaId: string, estado: 'PRESENTE' | 'AVISO_AUSENCIA' | 'PENALIZADA') {
    await apiFetch(`/api/admin/reservas/${reservaId}/marcar`, {
      method: 'POST',
      body: JSON.stringify({ estado }),
    }, token);
    await cargar();
    if (celdaAbierta) {
      const updated = celdasPorDia.flat().find((c) => c.key === celdaAbierta.key);
      setCeldaAbierta(updated ?? null);
    }
  }

  async function cancelarReserva(reservaId: string) {
    if (!confirm('¿Cancelar esta reserva? El ticket se libera al alumno.')) return;
    try {
      await apiFetch(`/api/admin/reservas?id=${reservaId}`, { method: 'DELETE' }, token);
      await cargar();
      if (celdaAbierta) {
        celdaAbierta.reservas = celdaAbierta.reservas.filter((r) => r.id !== reservaId);
        setCeldaAbierta({ ...celdaAbierta });
      }
    } catch (err: any) {
      alert(err?.message ?? 'No pudimos cancelar la reserva.');
    }
  }

  async function marcarNoVinoMasivo() {
    if (!celdaAbierta) return;
    const pendientes = celdaAbierta.reservas.filter((r) => r.estadoAsistencia === 'PENDIENTE');
    if (pendientes.length === 0) return;
    if (!confirm(`Marcar ${pendientes.length} alumno(s) como "no vino sin aviso" (penalizado)?`)) return;
    await Promise.all(pendientes.map((r) => marcarReserva(r.id, 'PENALIZADA')));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-['Anton'] uppercase text-2xl">Reservas</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => moverSemana(-7)} className="p-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] transition-colors" title="Semana anterior">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="square" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="px-3 py-2 border border-[var(--ink-line)] text-sm text-[var(--chalk)] font-mono tabular-nums min-w-[160px] text-center capitalize">
            {fmtRango(inicioSemana, finSemana)}
          </div>
          <button onClick={() => moverSemana(7)} className="p-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] transition-colors" title="Semana siguiente">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="square" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={() => setInicioSemana(inicioSemanaLunes(new Date()))} className="px-3 py-2 border border-[var(--ink-line)] text-[var(--rock)] hover:text-[var(--chalk)] hover:border-[var(--rock)] text-xs uppercase tracking-wide transition-colors">
            Hoy
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)] transition-colors">
          <option value="">Todos los tipos</option>
          {tiposClase.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroProfesorId} onChange={(e) => setFiltroProfesorId(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)] transition-colors">
          <option value="">Todos los profesores</option>
          {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {(filtroTipo || filtroProfesorId) && (
          <button onClick={() => { setFiltroTipo(''); setFiltroProfesorId(''); }} className="text-xs uppercase tracking-wide text-[var(--rock)] hover:text-[var(--chalk)] px-2">Limpiar</button>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-3 text-[10px] uppercase tracking-[0.15em] text-[var(--rock-dim)] flex-wrap">
        <span>Ocupación:</span>
        <LegendItem color="var(--good)" label="< 40%" />
        <LegendItem color="var(--gold)" label="40-75%" />
        <LegendItem color="var(--warn)" label="75-100%" />
        <LegendItem color="var(--crit)" label="Lleno" />
      </div>

      {/* Grilla semanal */}
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-7 gap-2 min-w-[840px]">
          {DIAS.map((label, i) => {
            const dia = new Date(inicioSemana);
            dia.setDate(dia.getDate() + i);
            const esHoy = dia.toDateString() === new Date().toDateString();
            return (
              <div key={label} className="min-h-[120px]">
                <div className={`text-center pb-2 border-b ${esHoy ? 'border-[var(--gold)]' : 'border-[var(--ink-line)]'}`}>
                  <p className={`text-[10px] uppercase tracking-[0.15em] ${esHoy ? 'text-[var(--gold)]' : 'text-[var(--rock-dim)]'}`}>{label}</p>
                  <p className={`font-mono tabular-nums text-lg ${esHoy ? 'text-[var(--gold)]' : 'text-[var(--chalk)]'}`}>{dia.getDate()}</p>
                </div>
                <div className="mt-2 space-y-2">
                  {celdasPorDia[i].map((celda) => (
                    <ReservaCelda key={celda.key} celda={celda} onClick={() => setCeldaAbierta(celda)} />
                  ))}
                  {celdasPorDia[i].length === 0 && (
                    <p className="text-[10px] text-[var(--rock-dim)] text-center py-4">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-xs text-[var(--rock-dim)] mt-3">Cargando…</p>}

      {/* Panel lateral */}
      {celdaAbierta && (
        <PanelCelda
          celda={celdaAbierta}
          onClose={() => setCeldaAbierta(null)}
          onMarcar={marcarReserva}
          onCancelar={cancelarReserva}
          onNoVinoMasivo={marcarNoVinoMasivo}
        />
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-3 h-3 border" style={{ borderColor: color, background: color + '20' }} />
      {label}
    </span>
  );
}

function PanelCelda({
  celda, onClose, onMarcar, onCancelar, onNoVinoMasivo,
}: {
  celda: Celda;
  onClose: () => void;
  onMarcar: (id: string, estado: 'PRESENTE' | 'AVISO_AUSENCIA' | 'PENALIZADA') => void;
  onCancelar: (id: string) => void;
  onNoVinoMasivo: () => void;
}) {
  const pendientes = celda.reservas.filter((r) => r.estadoAsistencia === 'PENDIENTE').length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" onMouseDown={onClose} />
      <div className="relative w-full max-w-md h-full bg-[var(--ink-raised)] border-l border-[var(--ink-line)] shadow-xl flex flex-col">
        <header className="p-5 border-b border-[var(--ink-line)] shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">{celda.fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              <h2 className="font-['Anton'] uppercase text-lg tracking-wide text-[var(--chalk)] mt-1">{celda.hora} · {celda.tipoClase}</h2>
              <p className="text-xs text-[var(--rock)] mt-1">
                {celda.profesorNombre ?? 'Sin profesor'} · {celda.reservas.length}{celda.cupoMaximo ? `/${celda.cupoMaximo}` : ''} anotados
              </p>
            </div>
            <button onClick={onClose} className="text-[var(--rock)] hover:text-[var(--chalk)] p-1 -mr-1" aria-label="Cerrar">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {celda.reservas.length === 0 && <p className="text-sm text-[var(--rock-dim)]">Sin alumnos anotados.</p>}
          <ul className="space-y-2">
            {celda.reservas.map((r) => (
              <li key={r.id} className="border border-[var(--ink-line)] bg-[var(--ink)] p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm text-[var(--chalk)]">{r.clienteNombre}</p>
                  <AsistenciaBadge estado={r.estadoAsistencia} />
                </div>
                {r.estadoAsistencia === 'PENDIENTE' && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <button onClick={() => onMarcar(r.id, 'PRESENTE')} className="px-2 py-1 border border-[var(--good)] text-[var(--good)] text-[10px] uppercase tracking-wide hover:bg-[rgb(79_174_109/0.1)] transition-colors">Presente</button>
                    <button onClick={() => onMarcar(r.id, 'AVISO_AUSENCIA')} className="px-2 py-1 border border-[var(--warn)] text-[var(--warn)] text-[10px] uppercase tracking-wide hover:bg-[rgb(217_123_41/0.1)] transition-colors">Aviso</button>
                    <button onClick={() => onMarcar(r.id, 'PENALIZADA')} className="px-2 py-1 border border-[var(--crit)] text-[var(--crit)] text-[10px] uppercase tracking-wide hover:bg-[rgb(225_80_61/0.1)] transition-colors">No vino</button>
                    <button onClick={() => onCancelar(r.id)} className="px-2 py-1 border border-[var(--ink-line)] text-[var(--rock)] text-[10px] uppercase tracking-wide hover:text-[var(--chalk)] transition-colors ml-auto">Cancelar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {pendientes > 0 && (
          <footer className="p-5 border-t border-[var(--ink-line)] shrink-0">
            <button
              onClick={onNoVinoMasivo}
              className="w-full py-2.5 border border-[var(--crit)] text-[var(--crit)] text-xs uppercase tracking-wide font-bold hover:bg-[rgb(225_80_61/0.1)] transition-colors"
            >
              Marcar {pendientes} pendientes como "no vino"
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

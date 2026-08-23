import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { AsistenciaBadge } from '../components/AsistenciaBadge';

function hoyISO() { return new Date().toISOString().slice(0, 10); }

export function ReservasPage() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [clienteIdRecupero, setClienteIdRecupero] = useState('');
  const [horarioIdRecupero, setHorarioIdRecupero] = useState('');
  const [errorRecupero, setErrorRecupero] = useState<string | null>(null);

  async function cargar() {
    const [r, h] = await Promise.all([apiFetch(`/api/admin/reservas?fecha=${fecha}`, {}, token), apiFetch('/api/admin/horarios', {}, token)]);
    setReservas(r.reservas);
    setHorarios(h.horarios);
  }

  useEffect(() => { cargar(); }, [fecha, token]);

  async function marcar(id: string, estado: 'PRESENTE' | 'AVISO_AUSENCIA') {
    await apiFetch(`/api/admin/reservas/${id}/marcar`, { method: 'POST', body: JSON.stringify({ estado }) }, token);
    cargar();
  }

  async function handleRecupero(e: FormEvent) {
    e.preventDefault();
    setErrorRecupero(null);
    try {
      await apiFetch('/api/admin/reservas', { method: 'POST', body: JSON.stringify({ clienteId: clienteIdRecupero, horarioId: horarioIdRecupero }) }, token);
      setClienteIdRecupero('');
      cargar();
    } catch (err) {
      setErrorRecupero((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">Reservas</h2>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2" />
      </div>

      <ul className="mb-8">
        {reservas.map((r) => (
          <li key={r.id} className="flex items-center justify-between border-t border-[var(--ink-line)] py-3 text-sm">
            <span>{new Date(r.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — {r.clienteNombre} — {r.tipoClase}</span>
            {r.estadoAsistencia === 'PENDIENTE' ? (
              <div className="flex gap-2">
                <button onClick={() => marcar(r.id, 'PRESENTE')} className="border border-[var(--good)] text-[var(--good)] text-xs uppercase px-3 py-1">Presente</button>
                <button onClick={() => marcar(r.id, 'AVISO_AUSENCIA')} className="border border-[var(--aviso)] text-[var(--aviso)] text-xs uppercase px-3 py-1">Aviso ausencia</button>
              </div>
            ) : (
              <AsistenciaBadge estado={r.estadoAsistencia} />
            )}
          </li>
        ))}
      </ul>

      <div className="border border-[var(--ink-line)] p-4">
        <p className="text-xs uppercase text-[var(--rock)] mb-3">Fichar recupero (alumno que faltó y viene hoy a otro horario)</p>
        {errorRecupero && <p className="text-[var(--crit)] text-sm mb-3">{errorRecupero}</p>}
        <form onSubmit={handleRecupero} className="flex gap-3">
          <input placeholder="ID del cliente" value={clienteIdRecupero} onChange={(e) => setClienteIdRecupero(e.target.value)}
            className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
          <select value={horarioIdRecupero} onChange={(e) => setHorarioIdRecupero(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
            <option value="">Horario de hoy</option>
            {horarios.map((h) => <option key={h.id} value={h.id}>{h.tipoClase} {h.hora}</option>)}
          </select>
          <button type="submit" className="bg-[var(--gold)] text-[var(--ink)] font-bold px-4 py-2 text-sm">Fichar recupero</button>
        </form>
      </div>
    </div>
  );
}

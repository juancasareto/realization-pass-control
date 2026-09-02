import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

export function CalendarioPage() {
  const { token } = useAuth();
  const [dias, setDias] = useState<any[]>([]);
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<'SETEO' | 'FERIADO'>('SETEO');
  const [nota, setNota] = useState('');

  async function cargar() {
    const data = await apiFetch('/api/admin/dias-excepcion', {}, token);
    setDias(data.dias);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/dias-excepcion', { method: 'POST', body: JSON.stringify({ fecha, tipo, nota }) }, token);
    setFecha('');
    setNota('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-2">Calendario</h2>
      <p className="text-sm text-[var(--rock)] mb-6">
        Un día de <strong>seteo</strong> cierra el muro completo (no hay clases ni escalada libre). Un <strong>feriado</strong> es solo un aviso —
        no cancela nada solo, decidís vos si tocás el horario ese día.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm rounded-md" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'SETEO' | 'FERIADO')} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm rounded-md">
          <option value="SETEO">Día de seteo (cierra todo)</option>
          <option value="FERIADO">Feriado (aviso)</option>
        </select>
        <input placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm rounded-md" />
        <button type="submit" className="bg-[var(--gold)] text-[var(--on-accent)] font-bold px-4 py-2 text-sm rounded-md">Agregar</button>
      </form>
      <ul>
        {dias.map((d) => (
          <li key={d.id} className="flex justify-between border-t border-[var(--ink-line)] py-3 text-sm">
            <span>{new Date(d.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })} — {d.nota ?? 'Sin nota'}</span>
            <span className={`font-mono text-xs uppercase ${d.tipo === 'SETEO' ? 'text-[var(--crit)]' : 'text-[var(--aviso)]'}`}>{d.tipo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function HorariosPage() {
  const { token } = useAuth();
  const [horarios, setHorarios] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [diaSemana, setDiaSemana] = useState(2);
  const [hora, setHora] = useState('19:00');
  const [tipoClase, setTipoClase] = useState('');
  const [profesorId, setProfesorId] = useState('');

  async function cargar() {
    const [h, p] = await Promise.all([
      apiFetch('/api/admin/horarios', {}, token),
      apiFetch('/api/admin/profesores', {}, token),
    ]);
    setHorarios(h.horarios);
    setProfesores(p.profesores);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/horarios', { method: 'POST', body: JSON.stringify({ diaSemana, hora, tipoClase, profesorId: profesorId || undefined }) }, token);
    setTipoClase('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Horarios</h2>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6 flex-wrap">
        <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          {DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <input placeholder="Tipo de clase" value={tipoClase} onChange={(e) => setTipoClase(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <select value={profesorId} onChange={(e) => setProfesorId(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          <option value="">Sin profesor asignado</option>
          {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button type="submit" className="bg-[var(--gold)] text-[var(--ink)] font-bold px-4 py-2 text-sm">Agregar horario</button>
      </form>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Día</th><th className="text-left py-2">Hora</th><th className="text-left py-2">Clase</th><th className="text-left py-2">Profe</th><th className="text-left py-2">Cupo</th></tr>
        </thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">{DIAS[h.diaSemana]}</td>
              <td className="py-3 font-mono tabular-nums">{h.hora}</td>
              <td className="py-3">{h.tipoClase}</td>
              <td className="py-3">{h.profesorNombre ?? '—'}</td>
              <td className="py-3 font-mono tabular-nums">{h.cupoMaximo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

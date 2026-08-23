import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const NOMBRES: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', MERCADOPAGO: 'Mercado Pago' };

export function CobrosPage() {
  const { token } = useAuth();
  const [cajas, setCajas] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [medio, setMedio] = useState('EFECTIVO');
  const [monto, setMonto] = useState(0);
  const [motivo, setMotivo] = useState('');

  async function cargar() {
    const data = await apiFetch('/api/admin/cobros', {}, token);
    setCajas(data.cajas);
    setMovimientos(data.movimientos);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleRetiro(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/cobros', { method: 'POST', body: JSON.stringify({ medio, monto, motivo }) }, token);
    setMonto(0);
    setMotivo('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Cobros</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {cajas.map((c) => (
          <div key={c.medio} className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-4">
            <p className="text-xs uppercase text-[var(--rock)] mb-2">{NOMBRES[c.medio]}</p>
            <p className="font-mono tabular-nums text-2xl">${c.saldo.toLocaleString('es-AR')}</p>
            <p className="text-xs text-[var(--rock-dim)] mt-1">+${c.entradas.toLocaleString('es-AR')} / -${c.retiros.toLocaleString('es-AR')}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleRetiro} className="flex gap-3 mb-8 flex-wrap">
        <select value={medio} onChange={(e) => setMedio(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          {Object.keys(NOMBRES).map((m) => <option key={m} value={m}>{NOMBRES[m]}</option>)}
        </select>
        <input type="number" placeholder="Monto" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <input placeholder="Motivo del retiro" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <button type="submit" className="border border-[var(--crit)] text-[var(--crit)] text-sm uppercase px-4 py-2">Registrar retiro</button>
      </form>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Movimientos</h3>
      <ul>
        {movimientos.map((m, i) => (
          <li key={i} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{NOMBRES[m.medio]} — {m.motivo}</span>
            <span className={`font-mono tabular-nums ${m.tipo === 'entrada' ? 'text-[var(--good)]' : 'text-[var(--crit)]'}`}>
              {m.tipo === 'entrada' ? '+' : '-'}${m.monto.toLocaleString('es-AR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

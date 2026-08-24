import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function VentaPasePage() {
  const { clienteId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [modalidadId, setModalidadId] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [medio, setMedio] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch('/api/admin/modalidades', {}, token), apiFetch('/api/admin/horarios', {}, token)]).then(([m, h]) => {
      setModalidades(m.modalidades.filter((x: any) => x.activo));
      setHorarios(h.horarios.filter((x: any) => x.activo));
    });
  }, [token]);

  const modalidadElegida = modalidades.find((m) => m.id === modalidadId);
  const esClases = modalidadElegida?.tipo === 'CLASES';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/admin/compras', {
        method: 'POST',
        body: JSON.stringify({ clienteId, modalidadId, medio, descuentoAplicado: descuento, horarioId: esClases ? horarioId : undefined }),
      }, token);
      navigate(`/admin/clientes/${clienteId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Vender pase</h2>
      {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
      <select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)} required className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 rounded-md">
        <option value="">Elegí un plan</option>
        {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre} — ${m.precio}</option>)}
      </select>
      {esClases && (
        <select value={horarioId} onChange={(e) => setHorarioId(e.target.value)} required className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 rounded-md">
          <option value="">Elegí el horario fijo</option>
          {horarios.map((h) => <option key={h.id} value={h.id}>{DIAS[h.diaSemana]} {h.hora} — {h.tipoClase}</option>)}
        </select>
      )}
      <select value={medio} onChange={(e) => setMedio(e.target.value)} className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 rounded-md">
        <option value="EFECTIVO">Efectivo</option>
        <option value="TRANSFERENCIA">Transferencia</option>
        <option value="TARJETA">Tarjeta</option>
        <option value="MERCADOPAGO">Mercado Pago</option>
      </select>
      <input type="number" placeholder="Descuento %" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))}
        className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2 rounded-md" />
      <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3 rounded-md">Registrar venta</button>
    </form>
  );
}

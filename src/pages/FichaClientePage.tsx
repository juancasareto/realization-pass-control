import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';
import { FotoUploader } from '../components/FotoUploader';

export function FichaClientePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  async function cargar() {
    const body = await apiFetch(`/api/admin/clientes/${id}`, {}, token);
    setData(body);
  }

  useEffect(() => { cargar(); }, [id, token]);

  async function subirFoto(base64: string) {
    await apiFetch(`/api/admin/clientes/${id}`, { method: 'POST', body: JSON.stringify({ fotoBase64: base64 }) }, token);
    cargar();
  }

  if (!data) return <p>Cargando…</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <FotoUploader fotoUrl={data.cliente.fotoUrl} onUpload={subirFoto} />
          <h2 className="font-['Anton'] uppercase text-2xl">{data.cliente.nombre}</h2>
        </div>
        <div className="flex items-center gap-3">
          <EstadoBadge estado={data.cliente.estado} />
          <Link to={`/admin/clientes/${id}/vender`} className="text-[var(--gold)] text-sm hover:underline">Vender pase</Link>
        </div>
      </div>

      <p className="font-mono tabular-nums text-3xl mb-4">{data.cliente.ticketsDisponibles} tickets</p>

      <div className="grid grid-cols-3 gap-3 mb-8 text-sm">
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Cliente desde</p>
          <p>{new Date(data.cliente.clienteDesde).toLocaleDateString('es-AR')}</p>
        </div>
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Ausencias sin aviso</p>
          <p className="font-mono tabular-nums">{data.cliente.ausenciasSinAviso}</p>
        </div>
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Última visita</p>
          <p>{data.cliente.ultimaVisita ? new Date(data.cliente.ultimaVisita).toLocaleDateString('es-AR') : 'Nunca'}</p>
        </div>
      </div>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Compras</h3>
      <ul className="mb-8">
        {data.compras.map((c: any) => (
          <li key={c.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{c.modalidad.nombre}</span><span className="font-mono tabular-nums">${c.precioPagado}</span>
          </li>
        ))}
      </ul>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Pagos</h3>
      <ul className="mb-8">
        {data.pagos.map((p: any) => (
          <li key={p.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{p.medio} — {Number(p.descuentoAplicado)}% desc.</span><span className="font-mono tabular-nums">${p.monto}</span>
          </li>
        ))}
      </ul>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Reservas y asistencias</h3>
      <ul>
        {data.reservas.map((r: any) => (
          <li key={r.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{new Date(r.fechaHora).toLocaleDateString('es-AR')} — {r.tipoClase}</span>
            <span className="font-mono text-xs uppercase text-[var(--rock)]">{r.estadoAsistencia}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

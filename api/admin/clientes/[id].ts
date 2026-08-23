import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      compras: { include: { tickets: true, modalidad: true }, orderBy: { fechaCompra: 'desc' } },
      pagos: { orderBy: { createdAt: 'desc' } },
      reservas: { orderBy: { fechaHora: 'desc' }, take: 30 },
    },
  });

  if (!cliente) { res.status(404).json({ error: 'No encontramos ese alumno.' }); return; }

  const [ausenciasSinAviso, ultimoCheckIn] = await Promise.all([
    prisma.reserva.count({ where: { clienteId: id, estadoAsistencia: 'PENALIZADA' } }),
    prisma.checkIn.findFirst({ where: { clienteId: id }, orderBy: { timestamp: 'desc' } }),
  ]);

  const ultimaCompra = cliente.compras[0] ?? null;
  const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;

  res.status(200).json({
    cliente: {
      id: cliente.id, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono, fotoUrl: cliente.fotoUrl,
      ticketsDisponibles, vencimiento: ultimaCompra?.vencimiento ?? null,
      estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
      clienteDesde: cliente.createdAt, ausenciasSinAviso, ultimaVisita: ultimoCheckIn?.timestamp ?? null,
    },
    compras: cliente.compras,
    pagos: cliente.pagos,
    reservas: cliente.reservas,
  });
}

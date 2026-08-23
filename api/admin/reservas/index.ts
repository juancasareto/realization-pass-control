import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { fecha } = req.query as { fecha: string };
  const inicio = new Date(`${fecha}T00:00:00.000Z`);
  const fin = new Date(`${fecha}T23:59:59.999Z`);

  const reservas = await prisma.reserva.findMany({
    where: { fechaHora: { gte: inicio, lte: fin } },
    include: { cliente: true },
    orderBy: { fechaHora: 'asc' },
  });

  res.status(200).json({
    reservas: reservas.map((r) => ({
      id: r.id, clienteId: r.clienteId, clienteNombre: r.cliente.nombre,
      fechaHora: r.fechaHora, tipoClase: r.tipoClase, estadoAsistencia: r.estadoAsistencia,
    })),
  });
}

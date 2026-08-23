import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { clienteId, horarioId } = req.body as { clienteId: string; horarioId: string };

  const horario = await prisma.horario.findUnique({ where: { id: horarioId } });
  if (!horario) { res.status(404).json({ error: 'El horario no existe.' }); return; }

  const limite = new Date(Date.now() - SIETE_DIAS_MS);
  const pendiente = await prisma.reserva.findFirst({
    where: { clienteId, estadoAsistencia: 'PENDIENTE', fechaHora: { lt: new Date(), gte: limite } },
    orderBy: { fechaHora: 'asc' },
  });

  if (!pendiente) {
    res.status(404).json({ error: 'Este alumno no tiene ninguna falta pendiente de recuperar en los últimos 7 días.' });
    return;
  }

  const ticketId = pendiente.ticketId;
  await prisma.reserva.update({ where: { id: pendiente.id }, data: { estadoAsistencia: 'RECUPERADA', ticketId: null } });

  const nueva = await prisma.reserva.create({
    data: {
      clienteId, ticketId: ticketId ?? undefined, horarioId, fechaHora: new Date(),
      tipoClase: horario.tipoClase, estadoAsistencia: 'PRESENTE', recuperaDeId: pendiente.id,
    },
  });

  if (ticketId) await prisma.ticket.update({ where: { id: ticketId }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });

  await prisma.checkIn.create({ data: { clienteId, reservaId: nueva.id, metodo: 'MANUAL' } });
  await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'recupero_clase', detalle: { reservaOriginalId: pendiente.id, nuevaReservaId: nueva.id } } });

  res.status(200).json({ reserva: nueva });
}

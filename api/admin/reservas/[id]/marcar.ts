import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, requireRol } from '../../../_lib/auth';
import { siguienteFechaHabil } from '../../compras/index';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };
  const { estado } = req.body as { estado: 'PRESENTE' | 'AVISO_AUSENCIA' };

  const reserva = await prisma.reserva.findUnique({ where: { id } });
  if (!reserva) { res.status(404).json({ error: 'No encontramos esa reserva.' }); return; }

  if (estado === 'PRESENTE') {
    await prisma.reserva.update({ where: { id }, data: { estadoAsistencia: 'PRESENTE' } });
    if (reserva.ticketId) {
      await prisma.ticket.update({ where: { id: reserva.ticketId }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });
    }
    await prisma.checkIn.create({ data: { clienteId: reserva.clienteId, reservaId: reserva.id, metodo: 'MANUAL' } });
    await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'checkin_manual', detalle: { reservaId: id } } });
    res.status(200).json({ ok: true });
    return;
  }

  if (estado === 'AVISO_AUSENCIA') {
    if (!reserva.horarioId) {
      res.status(422).json({ error: 'Esta reserva no tiene un horario fijo, no se puede reprogramar sola.' });
      return;
    }
    const horario = await prisma.horario.findUnique({ where: { id: reserva.horarioId } });
    const ticketId = reserva.ticketId;

    await prisma.reserva.update({ where: { id }, data: { estadoAsistencia: 'AVISO_AUSENCIA', ticketId: null } });

    const nuevaFecha = await siguienteFechaHabil(horario!.diaSemana, horario!.hora, new Date(reserva.fechaHora.getTime() + 86400000));
    await prisma.reserva.create({
      data: { clienteId: reserva.clienteId, ticketId: ticketId ?? undefined, horarioId: reserva.horarioId, fechaHora: nuevaFecha, tipoClase: reserva.tipoClase },
    });

    await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'aviso_ausencia', detalle: { reservaOriginalId: id, nuevaFecha } } });
    res.status(200).json({ ok: true, nuevaFecha });
    return;
  }

  res.status(422).json({ error: 'Estado inválido. Usá PRESENTE o AVISO_AUSENCIA.' });
}

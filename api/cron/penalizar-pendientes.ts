import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const limite = new Date(Date.now() - SIETE_DIAS_MS);
  const vencidas = await prisma.reserva.findMany({ where: { estadoAsistencia: 'PENDIENTE', fechaHora: { lt: limite } } });

  for (const r of vencidas) {
    await prisma.reserva.update({ where: { id: r.id }, data: { estadoAsistencia: 'PENALIZADA' } });
    if (r.ticketId) await prisma.ticket.update({ where: { id: r.ticketId }, data: { estado: 'PENALIZADO', consumidoAt: new Date() } });
    await prisma.activity.create({
      data: { actorId: 'system', actorRol: 'ADMIN', accion: 'penalizacion_no_show', detalle: { reservaId: r.id, clienteId: r.clienteId } },
    });
  }

  res.status(200).json({ penalizadas: vencidas.length });
}

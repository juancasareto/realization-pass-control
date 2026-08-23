import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
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
    return;
  }

  if (req.method === 'POST') {
    const accion = (req.query?.accion) as string | undefined;

    // Check-in libre: alumno se presenta sin reserva previa.
    // Consume el próximo ticket disponible del último plan y crea una reserva PRESENTE + check-in.
    if (accion === 'checkin_libre') {
      const { clienteId, tipoClase } = req.body as { clienteId: string; tipoClase?: string };

      const compra = await prisma.compra.findFirst({
        where: { clienteId, tickets: { some: { estado: 'DISPONIBLE' } } },
        include: { tickets: { where: { estado: 'DISPONIBLE' }, take: 1 } },
        orderBy: { fechaCompra: 'desc' },
      });

      if (!compra || compra.tickets.length === 0) {
        res.status(422).json({ error: 'El alumno no tiene tickets disponibles.' });
        return;
      }

      if (compra.vencimiento && compra.vencimiento < new Date()) {
        res.status(422).json({ error: 'El plan del alumno está vencido.' });
        return;
      }

      const ticket = compra.tickets[0];
      const nueva = await prisma.reserva.create({
        data: {
          clienteId, ticketId: ticket.id, fechaHora: new Date(),
          tipoClase: tipoClase ?? 'Libre', estadoAsistencia: 'PRESENTE',
        },
      });

      await prisma.ticket.update({ where: { id: ticket.id }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });
      await prisma.checkIn.create({ data: { clienteId, reservaId: nueva.id, metodo: 'MANUAL' } });
      await prisma.activity.create({
        data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'checkin_libre', detalle: { reservaId: nueva.id, ticketId: ticket.id } },
      });

      res.status(200).json({ reserva: nueva });
      return;
    }

    // Aviso de ausencia con opción de "ticket extra al final": no reprograma, agrega un ticket
    // disponible a la última compra activa. Requiere reservaId de la reserva a la que se le avisa.
    if (accion === 'aviso_ticket_extra') {
      const { reservaId } = req.body as { reservaId: string };

      const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
      if (!reserva) { res.status(404).json({ error: 'No encontramos esa reserva.' }); return; }

      const ticketId = reserva.ticketId;
      const compra = ticketId
        ? await prisma.ticket.findUnique({ where: { id: ticketId } }).then((t) => t ? prisma.compra.findUnique({ where: { id: t.compraId } }) : null)
        : await prisma.compra.findFirst({ where: { clienteId: reserva.clienteId }, orderBy: { fechaCompra: 'desc' } });

      if (!compra) { res.status(422).json({ error: 'El alumno no tiene una compra activa para agregar el ticket.' }); return; }

      await prisma.reserva.update({ where: { id: reservaId }, data: { estadoAsistencia: 'AVISO_AUSENCIA', ticketId: null } });
      const ticketExtra = await prisma.ticket.create({ data: { compraId: compra.id, estado: 'DISPONIBLE' } });

      await prisma.activity.create({
        data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'aviso_ausencia_ticket_extra', detalle: { reservaId, ticketExtraId: ticketExtra.id } },
      });

      res.status(200).json({ ok: true, ticketExtraId: ticketExtra.id });
      return;
    }

    // Recupero clásico: alumno vino a otro horario tras una falta pendiente.
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
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/[id]/marcar';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// El horario de prueba usa diaSemana: 2 (martes). Para que la reprogramación a
// "una semana después" sea determinística sin importar qué día corra la
// suite, anclamos fechaOriginal al próximo martes en vez de `new Date()`.
function proximoMartes(): Date {
  const d = new Date();
  const diaActual = d.getUTCDay() || 7; // ISO: 1=lunes ... 7=domingo
  let delta = 2 - diaActual;
  if (delta <= 0) delta += 7;
  d.setUTCDate(d.getUTCDate() + delta);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

describe('POST /api/admin/reservas/:id/marcar', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let horarioId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'marcar-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Marcar Test', email: 'marcar-test-cliente@realization.com' } });
    clienteId = cliente.id;
    const horario = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    horarioId = horario.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.horario.delete({ where: { id: horarioId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'marcar-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: { in: ['checkin_manual', 'aviso_ausencia'] } } });
    await prisma.$disconnect();
  });

  it('PRESENTE consumes the ticket and logs a check-in', async () => {
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Marcar Test x1', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    const reserva = await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, horarioId, fechaHora: new Date(), tipoClase: 'Boulder' } });

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: reserva.id }, body: { estado: 'PRESENTE' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const ticket = await prisma.ticket.findUnique({ where: { id: compra.tickets[0].id } });
    expect(ticket?.estado).toBe('CONSUMIDO');

    const actualizada = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(actualizada?.estadoAsistencia).toBe('PRESENTE');

    await prisma.checkIn.deleteMany({ where: { reservaId: reserva.id } });
    await prisma.reserva.delete({ where: { id: reserva.id } });
    await prisma.ticket.deleteMany({ where: { compraId: compra.id } });
    await prisma.compra.delete({ where: { id: compra.id } });
    await prisma.modalidad.delete({ where: { id: modalidad.id } });
  });

  it('AVISO_AUSENCIA does not consume the ticket, colors it, and appends a reserva one week later', async () => {
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Marcar Test x1 aviso', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    const fechaOriginal = proximoMartes();
    const reserva = await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, horarioId, fechaHora: fechaOriginal, tipoClase: 'Boulder' } });

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: reserva.id }, body: { estado: 'AVISO_AUSENCIA' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const ticket = await prisma.ticket.findUnique({ where: { id: compra.tickets[0].id } });
    expect(ticket?.estado).toBe('DISPONIBLE');

    const original = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(original?.estadoAsistencia).toBe('AVISO_AUSENCIA');
    expect(original?.ticketId).toBeNull();

    const nueva = await prisma.reserva.findFirst({ where: { ticketId: compra.tickets[0].id } });
    expect(nueva).not.toBeNull();
    const diffDias = (nueva!.fechaHora.getTime() - fechaOriginal.getTime()) / 86400000;
    expect(Math.round(diffDias)).toBe(7);

    await prisma.reserva.deleteMany({ where: { compra: undefined, ticketId: compra.tickets[0].id } });
    await prisma.reserva.delete({ where: { id: reserva.id } });
    await prisma.ticket.deleteMany({ where: { compraId: compra.id } });
    await prisma.compra.delete({ where: { id: compra.id } });
    await prisma.modalidad.delete({ where: { id: modalidad.id } });
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/reservas/recuperar', () => {
  let adminToken: string;
  let clienteId: string;
  let ticketId: string;
  let horarioFaltadoId: string;
  let horarioOtroId: string;
  let reservaPendienteId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'recuperar-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Recuperar Test', email: 'recuperar-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Recuperar Test x1', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    ticketId = compra.tickets[0].id;

    const horarioFaltado = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    horarioFaltadoId = horarioFaltado.id;
    const horarioOtro = await prisma.horario.create({ data: { diaSemana: 4, hora: '20:00', tipoClase: 'Boulder avanzado' } });
    horarioOtroId = horarioOtro.id;

    const reserva = await prisma.reserva.create({
      data: { clienteId, ticketId, horarioId: horarioFaltado.id, fechaHora: new Date(Date.now() - 3 * 86400000), tipoClase: 'Boulder' },
    });
    reservaPendienteId = reserva.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.horario.deleteMany({ where: { id: { in: [horarioFaltadoId, horarioOtroId] } } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Recuperar Test x1' } });
    await prisma.admin.delete({ where: { email: 'recuperar-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: 'recupero_clase' } });
    await prisma.$disconnect();
  });

  it('resolves the pending reserva against a walk-in at a different horario and consumes its ticket', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { clienteId, horarioId: horarioOtroId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const original = await prisma.reserva.findUnique({ where: { id: reservaPendienteId } });
    expect(original?.estadoAsistencia).toBe('RECUPERADA');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.estado).toBe('CONSUMIDO');

    const nueva = res.json.mock.calls[0][0].reserva;
    expect(nueva.recuperaDeId).toBe(reservaPendienteId);
    expect(nueva.estadoAsistencia).toBe('PRESENTE');
  });

  it('returns 404 when the cliente has no pending falta within 7 days', async () => {
    const otroCliente = await prisma.cliente.create({ data: { nombre: 'Sin pendientes', email: 'sin-pendientes@realization.com' } });
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { clienteId: otroCliente.id, horarioId: horarioOtroId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    await prisma.cliente.delete({ where: { id: otroCliente.id } });
  });
});

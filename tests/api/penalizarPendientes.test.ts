import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import handler from '../../api/cron/penalizar-pendientes';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('cron penalizar-pendientes', () => {
  let clienteId: string;
  let ticketVencidoId: string;
  let ticketReciente: string;

  beforeAll(async () => {
    process.env.CRON_SECRET = 'test-secret';
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Cron Test x2', tipo: 'CLASES', conZapas: false, cantTickets: 2, precio: 12000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Cron Test', email: 'cron-test@realization.com' } });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 12000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    ticketVencidoId = compra.tickets[0].id;
    ticketReciente = compra.tickets[1].id;

    // falta de hace 8 dias, sin resolver -> debe penalizarse
    await prisma.reserva.create({ data: { clienteId, ticketId: ticketVencidoId, fechaHora: new Date(Date.now() - 8 * 86400000), tipoClase: 'Boulder' } });
    // falta de hace 2 dias -> todavia dentro de ventana, no se toca
    await prisma.reserva.create({ data: { clienteId, ticketId: ticketReciente, fechaHora: new Date(Date.now() - 2 * 86400000), tipoClase: 'Boulder' } });
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { accion: 'penalizacion_no_show' } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Cron Test x2' } });
    await prisma.$disconnect();
  });

  it('penalizes only the reserva pending for more than 7 days', async () => {
    const req: any = { method: 'GET', headers: { authorization: 'Bearer test-secret' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const vencido = await prisma.ticket.findUnique({ where: { id: ticketVencidoId } });
    expect(vencido?.estado).toBe('PENALIZADO');

    const reciente = await prisma.ticket.findUnique({ where: { id: ticketReciente } });
    expect(reciente?.estado).toBe('DISPONIBLE');
  });
});

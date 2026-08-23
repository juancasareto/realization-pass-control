import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/dashboard/hoy';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/dashboard/hoy', () => {
  let adminToken: string;
  let clienteId: string;
  let compraId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'dashboard-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Dashboard Test x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Dashboard Test Cliente', email: 'dashboard-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        // 1 disponible + 1 consumido: entra en "planes por vencer" (<=1 disponible)
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'CONSUMIDO', consumidoAt: new Date() }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
      include: { tickets: true },
    });
    compraId = compra.id;

    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL' } });
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, fechaHora: new Date(), tipoClase: 'Boulder' } });
    // una falta pendiente de hace 3 dias, todavia dentro de la ventana de 7
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[1].id, fechaHora: new Date(Date.now() - 3 * 86400000), tipoClase: 'Boulder' } });
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compraId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Dashboard Test x4' } });
    await prisma.admin.delete({ where: { email: 'dashboard-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('aggregates checkins, reservas, cobros, planes por vencer, pendientes de recuperar, e ingresos de 7 dias', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.checkInsHoy).toBeGreaterThanOrEqual(1);
    expect(body.reservasHoy).toBeGreaterThanOrEqual(1);
    expect(body.cobrosHoyTotal).toBeGreaterThanOrEqual(18000);
    expect(body.cobrosHoyPorMedio.EFECTIVO).toBeGreaterThanOrEqual(18000);
    expect(body.planesPorVencer.some((a: any) => a.id === clienteId)).toBe(true);
    expect(body.pendientesDeRecuperar.some((p: any) => p.clienteId === clienteId && p.diasRestantes === 4)).toBe(true);
    expect(body.ingresosUltimos7Dias).toHaveLength(7);
    expect(body.checkInsUltimos7Dias).toHaveLength(7);
  });
});

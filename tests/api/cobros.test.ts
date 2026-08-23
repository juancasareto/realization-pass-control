import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/cobros/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/cobros', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let compraId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'cobros-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Cobros Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Cobros Test', email: 'cobros-test-cliente@realization.com' } });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        tickets: { create: Array.from({ length: 4 }, () => ({ estado: 'DISPONIBLE' as const })) },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
    });
    compraId = compra.id;

    await prisma.retiro.create({ data: { medio: 'EFECTIVO', monto: 5000, motivo: 'Pago proveedor', actorId: adminId } });
  });

  afterAll(async () => {
    await prisma.retiro.deleteMany({ where: { actorId: adminId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compraId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Cobros Test x4' } });
    await prisma.admin.delete({ where: { email: 'cobros-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('reports one caja per medio with entradas, retiros, and saldo correcto', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.cajas).toHaveLength(4);
    const efectivo = body.cajas.find((c: any) => c.medio === 'EFECTIVO');
    expect(efectivo.entradas).toBeGreaterThanOrEqual(18000);
    expect(efectivo.retiros).toBeGreaterThanOrEqual(5000);
    expect(efectivo.saldo).toBe(efectivo.entradas - efectivo.retiros);

    const mercadopago = body.cajas.find((c: any) => c.medio === 'MERCADOPAGO');
    expect(mercadopago.entradas).toBe(0);
    expect(mercadopago.saldo).toBe(0);
  });
});

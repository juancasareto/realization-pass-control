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

describe('GET /api/admin/reservas', () => {
  let adminToken: string;
  let clienteId: string;
  const hoy = new Date();
  hoy.setUTCHours(22, 0, 0, 0); // 19:00 ART

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'reservas-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Reserva Test', email: 'reservas-test-cliente@realization.com' } });
    clienteId = cliente.id;
    await prisma.reserva.create({ data: { clienteId, fechaHora: hoy, tipoClase: 'Boulder intermedio' } });
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'reservas-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('lists reservas for the given date with clienteNombre resolved', async () => {
    const fecha = hoy.toISOString().slice(0, 10);
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { fecha } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.reservas.some((r: any) => r.clienteNombre === 'Reserva Test')).toBe(true);
  });
});

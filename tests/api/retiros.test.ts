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

describe('POST /api/admin/cobros/retiros', () => {
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'retiros-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.retiro.deleteMany({ where: { actorId: adminId } });
    await prisma.admin.delete({ where: { email: 'retiros-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a retiro tagged with the calling admin', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { medio: 'EFECTIVO', monto: 3000, motivo: 'Retiro personal' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);

    const retiro = await prisma.retiro.findFirst({ where: { actorId: adminId } });
    expect(retiro?.motivo).toBe('Retiro personal');
    expect(Number(retiro?.monto)).toBe(3000);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/modalidades/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/modalidades', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'modalidades-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.modalidad.deleteMany({ where: { nombre: 'Pase x6' } });
    await prisma.admin.delete({ where: { email: 'modalidades-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a new modalidad and lists it', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { nombre: 'Pase x6', tipo: 'LIBRE', conZapas: false, cantTickets: 6, precio: 24000 } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    const body = listRes.json.mock.calls[0][0];
    expect(body.modalidades.some((m: any) => m.nombre === 'Pase x6')).toBe(true);
  });
});

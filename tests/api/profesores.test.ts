import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/profesores/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/profesores', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'profesores-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.profesor.deleteMany({ where: { nombre: 'Sofía' } });
    await prisma.admin.delete({ where: { email: 'profesores-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates and lists a profesor', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { nombre: 'Sofía' } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    expect(listRes.json.mock.calls[0][0].profesores.some((p: any) => p.nombre === 'Sofía')).toBe(true);
  });
});

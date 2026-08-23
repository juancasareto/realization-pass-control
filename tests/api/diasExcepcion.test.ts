import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler, { esDiaDeSeteo } from '../../api/admin/dias-excepcion/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/dias-excepcion', () => {
  let adminToken: string;
  const fechaSeteo = new Date('2026-09-15T00:00:00.000Z');

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'dias-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.diaExcepcion.deleteMany({ where: { fecha: fechaSeteo } });
    await prisma.admin.delete({ where: { email: 'dias-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a día de seteo and esDiaDeSeteo confirms it', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { fecha: fechaSeteo.toISOString(), tipo: 'SETEO', nota: 'Cambio de vías del sector boulder' } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    expect(await esDiaDeSeteo(fechaSeteo)).toBe(true);
    expect(await esDiaDeSeteo(new Date('2026-09-16T00:00:00.000Z'))).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/horarios/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/horarios', () => {
  let adminToken: string;
  let profesorId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'horarios-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const profesor = await prisma.profesor.create({ data: { nombre: 'Horarios Test Profe' } });
    profesorId = profesor.id;
  });

  afterAll(async () => {
    await prisma.horario.deleteMany({ where: { profesorId } });
    await prisma.profesor.delete({ where: { id: profesorId } });
    await prisma.admin.delete({ where: { email: 'horarios-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a horario with the default cupo of 40 and lists it with the profesor name resolved', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { diaSemana: 4, hora: '20:00', tipoClase: 'Boulder avanzado', profesorId } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json.mock.calls[0][0].horarios[0].cupoMaximo).toBe(40);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    const found = listRes.json.mock.calls[0][0].horarios.find((h: any) => h.tipoClase === 'Boulder avanzado');
    expect(found.profesorNombre).toBe('Horarios Test Profe');
  });
});

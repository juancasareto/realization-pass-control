import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../../api/_lib/prisma';
import handler from '../../api/auth/login';
import { verifyToken } from '../../api/_lib/auth';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await prisma.admin.upsert({
      where: { email: 'login-test@realization.com' },
      update: { passwordHash },
      create: { nombre: 'Test Admin', email: 'login-test@realization.com', passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.admin.delete({ where: { email: 'login-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const req: any = { method: 'POST', body: { email: 'login-test@realization.com', password: 'secret123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const token = res.json.mock.calls[0][0].token;
    expect(verifyToken(token)?.rol).toBe('ADMIN');
  });

  it('returns 401 for wrong password', async () => {
    const req: any = { method: 'POST', body: { email: 'login-test@realization.com', password: 'wrong' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

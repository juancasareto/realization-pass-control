import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example.com/clientes/fake.jpg' }),
}));

import handler from '../../api/admin/clientes/[id]/foto';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/clientes/:id/foto', () => {
  let adminToken: string;
  let clienteId: string;
  const PIXEL_1X1_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'foto-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Foto Test', email: 'foto-test-cliente@realization.com' } });
    clienteId = cliente.id;
  });

  afterAll(async () => {
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'foto-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('uploads the photo and saves the URL on the cliente', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId },
      body: { fotoBase64: `data:image/jpeg;base64,${PIXEL_1X1_JPEG_BASE64}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].fotoUrl).toBe('https://blob.example.com/clientes/fake.jpg');

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    expect(cliente?.fotoUrl).toBe('https://blob.example.com/clientes/fake.jpg');
  });

  it('rejects a body that is not a data URL', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId }, body: { fotoBase64: 'no-es-una-imagen' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(422);
  });
});

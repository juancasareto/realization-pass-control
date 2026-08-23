import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/clientes/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/clientes', () => {
  let adminToken: string;
  let clienteActivoId: string;
  let clienteVencidoId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'clientes-test-admin@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 10000 } });

    const activo = await prisma.cliente.create({ data: { nombre: 'Julieta Activa', email: 'julieta-activa@realization.com' } });
    clienteActivoId = activo.id;
    await prisma.compra.create({
      data: { clienteId: activo.id, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 10000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] } },
    });

    const vencido = await prisma.cliente.create({ data: { nombre: 'Nico Vencido', email: 'nico-vencido@realization.com' } });
    clienteVencidoId = vencido.id;
    await prisma.compra.create({
      data: { clienteId: vencido.id, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 10000,
        tickets: { create: [{ estado: 'CONSUMIDO' }, { estado: 'CONSUMIDO' }] } },
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { compra: { clienteId: { in: [clienteActivoId, clienteVencidoId] } } } });
    await prisma.compra.deleteMany({ where: { clienteId: { in: [clienteActivoId, clienteVencidoId] } } });
    await prisma.cliente.deleteMany({ where: { id: { in: [clienteActivoId, clienteVencidoId] } } });
    await prisma.admin.delete({ where: { email: 'clientes-test-admin@realization.com' } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Test x4' } });
    await prisma.$disconnect();
  });

  it('rejects without auth', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('filters by search text (q)', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { q: 'Julieta' } } as any, res);
    const body = res.json.mock.calls[0][0];
    expect(body.clientes).toHaveLength(1);
    expect(body.clientes[0].nombre).toBe('Julieta Activa');
  });

  it('filters by estado', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { estado: 'vencido' } } as any, res);
    const body = res.json.mock.calls[0][0];
    expect(body.clientes.some((c: any) => c.id === clienteVencidoId)).toBe(true);
    expect(body.clientes.some((c: any) => c.id === clienteActivoId)).toBe(false);
  });
});

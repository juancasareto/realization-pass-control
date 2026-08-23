import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/clientes/[id]';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/clientes/:id', () => {
  let adminToken: string;
  let clienteId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'ficha-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Ficha Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Ficha Test Cliente', email: 'ficha-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }, { estado: 'CONSUMIDO' }, { estado: 'PENALIZADO' }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
      include: { tickets: true },
    });

    // una reserva penalizada (cuenta como "ausencia sin aviso") y un check-in reciente
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[3].id, fechaHora: new Date(Date.now() - 10 * 86400000), tipoClase: 'Boulder', estadoAsistencia: 'PENALIZADA' } });
    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL', timestamp: new Date(Date.now() - 2 * 86400000) } });
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Ficha Test x4' } });
    await prisma.admin.delete({ where: { email: 'ficha-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('returns cliente stats, estado, compras, pagos, and reservas con estadoAsistencia', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.cliente.ticketsDisponibles).toBe(2);
    expect(body.cliente.estado).toBe('por_vencer');
    expect(body.cliente.ausenciasSinAviso).toBe(1);
    expect(body.cliente.ultimaVisita).not.toBeNull();
    expect(body.cliente.clienteDesde).not.toBeNull();
    expect(body.reservas.some((r: any) => r.estadoAsistencia === 'PENALIZADA')).toBe(true);
  });
});

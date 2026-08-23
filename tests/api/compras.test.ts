import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/compras/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

import { vi } from 'vitest';

describe('POST /api/admin/compras', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let modalidadLibreId: string;
  let modalidadClasesId: string;
  let horarioId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'compras-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const cliente = await prisma.cliente.create({ data: { nombre: 'Compra Test', email: 'compras-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const modalidadLibre = await prisma.modalidad.create({ data: { nombre: 'Compra Test Libre x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    modalidadLibreId = modalidadLibre.id;

    const modalidadClases = await prisma.modalidad.create({ data: { nombre: 'Compra Test Clases x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 20000 } });
    modalidadClasesId = modalidadClases.id;

    const horario = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    horarioId = horario.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { id: { in: [modalidadLibreId, modalidadClasesId] } } });
    await prisma.horario.delete({ where: { id: horarioId } });
    await prisma.admin.delete({ where: { email: 'compras-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: 'venta_pase' } });
    await prisma.$disconnect();
  });

  it('LIBRE: creates tickets and a pago, no reservas', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadLibreId, medio: 'EFECTIVO', descuentoAplicado: 10 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const compra = res.json.mock.calls[0][0].compra;

    const tickets = await prisma.ticket.findMany({ where: { compraId: compra.id } });
    expect(tickets).toHaveLength(4);

    const reservas = await prisma.reserva.findMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } });
    expect(reservas).toHaveLength(0);
  });

  it('CLASES: requires horarioId and generates one reserva por ticket a una semana de distancia', async () => {
    const sinHorario: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadClasesId, medio: 'EFECTIVO' } };
    const resSinHorario = mockRes();
    await handler(sinHorario, resSinHorario);
    expect(resSinHorario.status).toHaveBeenCalledWith(422);

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadClasesId, medio: 'TRANSFERENCIA', horarioId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const compra = res.json.mock.calls[0][0].compra;

    const reservas = await prisma.reserva.findMany({ where: { horarioId, ticket: { compraId: compra.id } }, orderBy: { fechaHora: 'asc' } });
    expect(reservas).toHaveLength(4);
    for (let i = 1; i < reservas.length; i++) {
      const diffDias = (reservas[i].fechaHora.getTime() - reservas[i - 1].fechaHora.getTime()) / 86400000;
      expect(diffDias).toBe(7);
    }
    expect(reservas.every((r) => r.estadoAsistencia === 'PENDIENTE')).toBe(true);

    const activity = await prisma.activity.findFirst({ where: { accion: 'venta_pase', actorId: adminId } });
    expect(activity).not.toBeNull();
  });
});

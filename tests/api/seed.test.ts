import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { runSeed } from '../../prisma/seed';

describe('seed script', () => {
  beforeAll(async () => { await runSeed(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates admin, modalidades, un profesor, un horario, y un cliente con 12 tickets', async () => {
    const admin = await prisma.admin.findUnique({ where: { email: 'dani@realization.com' } });
    expect(admin).not.toBeNull();

    const profesor = await prisma.profesor.findFirst({ where: { nombre: 'Marcos' } });
    expect(profesor).not.toBeNull();

    const horario = await prisma.horario.findFirst({ where: { profesorId: profesor!.id } });
    expect(horario?.cupoMaximo).toBe(40);

    const cliente = await prisma.cliente.findUnique({
      where: { email: 'maria@example.com' },
      include: { compras: { include: { tickets: true } } },
    });
    expect(cliente!.compras[0].tickets).toHaveLength(12);
  });
});

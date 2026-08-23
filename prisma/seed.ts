import bcrypt from 'bcryptjs';
import { prisma } from '../api/_lib/prisma';

export async function runSeed() {
  const passwordHash = await bcrypt.hash('realization2026', 10);
  await prisma.admin.upsert({
    where: { email: 'dani@realization.com' },
    update: {},
    create: { nombre: 'Dani', email: 'dani@realization.com', passwordHash },
  });

  const paseX12 = await prisma.modalidad.upsert({
    where: { id: 'seed-pase-x12' }, update: {},
    create: { id: 'seed-pase-x12', nombre: 'Pase x12', tipo: 'LIBRE', conZapas: false, cantTickets: 12, precio: 45000 },
  });
  await prisma.modalidad.upsert({
    where: { id: 'seed-clase-suelta' }, update: {},
    create: { id: 'seed-clase-suelta', nombre: 'Clase suelta', tipo: 'CLASES', conZapas: true, cantTickets: 1, precio: 6000 },
  });
  await prisma.modalidad.upsert({
    where: { id: 'seed-pase-x4' }, update: {},
    create: { id: 'seed-pase-x4', nombre: 'Pase x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000 },
  });

  const profesor = await prisma.profesor.upsert({
    where: { id: 'seed-profesor-marcos' }, update: {},
    create: { id: 'seed-profesor-marcos', nombre: 'Marcos' },
  });

  await prisma.horario.upsert({
    where: { id: 'seed-horario-martes-19' }, update: {},
    create: {
      id: 'seed-horario-martes-19', diaSemana: 2, hora: '19:00',
      tipoClase: 'Boulder intermedio', cupoMaximo: 40, profesorId: profesor.id,
    },
  });

  const cliente = await prisma.cliente.upsert({
    where: { email: 'maria@example.com' }, update: {},
    create: { nombre: 'María González', email: 'maria@example.com', telefono: '1122334455' },
  });

  const vencimiento = new Date();
  vencimiento.setDate(vencimiento.getDate() + 60);

  const compra = await prisma.compra.create({
    data: {
      clienteId: cliente.id, modalidadId: paseX12.id, vencimiento, precioPagado: paseX12.precio,
      tickets: { create: Array.from({ length: 12 }, () => ({ estado: 'DISPONIBLE' as const })) },
    },
  });

  await prisma.pago.create({
    data: { clienteId: cliente.id, compraId: compra.id, monto: paseX12.precio, medio: 'EFECTIVO', descuentoAplicado: 10 },
  });
}

// Handle both ESM and direct execution
const isDirectExecution = process.argv[1] === new URL(import.meta.url).pathname;
if (isDirectExecution) {
  runSeed()
    .then(() => prisma.$disconnect())
    .catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
}

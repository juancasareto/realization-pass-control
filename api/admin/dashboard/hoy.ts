import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta.js';

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const hoyInicio = inicioDelDia(new Date());
  const hoyFin = new Date(hoyInicio.getTime() + 86400000);
  const inicio7d = new Date(hoyInicio.getTime() - 6 * 86400000);

  const [checkInsHoy, reservasHoy, pagosHoy, clientes, checkInsRecientes, pendientes, pagos7d, checkIns7d] = await Promise.all([
    prisma.checkIn.count({ where: { timestamp: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.reserva.count({ where: { fechaHora: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.pago.findMany({ where: { createdAt: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.cliente.findMany({ include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } } }),
    prisma.checkIn.findMany({ where: { timestamp: { gte: hoyInicio, lt: hoyFin } }, include: { cliente: true }, orderBy: { timestamp: 'desc' }, take: 10 }),
    prisma.reserva.findMany({ where: { estadoAsistencia: 'PENDIENTE', fechaHora: { lt: new Date() } }, include: { cliente: true }, orderBy: { fechaHora: 'asc' } }),
    prisma.pago.findMany({ where: { createdAt: { gte: inicio7d, lt: hoyFin } }, select: { createdAt: true, monto: true } }),
    prisma.checkIn.findMany({ where: { timestamp: { gte: inicio7d, lt: hoyFin } }, select: { timestamp: true } }),
  ]);

  const cobrosHoyTotal = pagosHoy.reduce((sum, p) => sum + Number(p.monto), 0);
  const cobrosHoyPorMedio: Record<string, number> = {};
  for (const p of pagosHoy) cobrosHoyPorMedio[p.medio] = (cobrosHoyPorMedio[p.medio] ?? 0) + Number(p.monto);

  const planesPorVencer = clientes
    .map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
      const estado = calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null);
      return { id: c.id, nombre: c.nombre, estado, ticketsDisponibles, vencimiento: ultimaCompra?.vencimiento ?? null };
    })
    .filter((c) => c.ticketsDisponibles <= 1 || c.estado === 'vencido')
    .sort((a, b) => a.ticketsDisponibles - b.ticketsDisponibles);

  const pendientesDeRecuperar = pendientes.map((r) => ({
    clienteId: r.clienteId,
    clienteNombre: r.cliente.nombre,
    fechaHora: r.fechaHora,
    diasRestantes: Math.max(0, 7 - Math.floor((Date.now() - r.fechaHora.getTime()) / 86400000)),
  }));

  const ingresosUltimos7Dias: { fecha: string; total: number }[] = [];
  const checkInsUltimos7Dias: { fecha: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dia = new Date(hoyInicio.getTime() - i * 86400000);
    const diaFin = new Date(dia.getTime() + 86400000);
    const fecha = dia.toISOString().slice(0, 10);
    const totalPagos = pagos7d.filter((p) => p.createdAt >= dia && p.createdAt < diaFin).reduce((s, p) => s + Number(p.monto), 0);
    const totalCheckIns = checkIns7d.filter((c) => c.timestamp >= dia && c.timestamp < diaFin).length;
    ingresosUltimos7Dias.push({ fecha, total: totalPagos });
    checkInsUltimos7Dias.push({ fecha, total: totalCheckIns });
  }

  res.status(200).json({
    checkInsHoy, reservasHoy, cobrosHoyTotal, cobrosHoyPorMedio, planesPorVencer, pendientesDeRecuperar, ingresosUltimos7Dias, checkInsUltimos7Dias,
    checkInsRecientes: checkInsRecientes.map((c) => ({ clienteNombre: c.cliente.nombre, timestamp: c.timestamp })),
  });
}

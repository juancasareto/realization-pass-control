import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';
import { calcularEstadoCuenta, type EstadoCuenta } from '../../_lib/estadoCuenta.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const { q, estado } = req.query as { q?: string; estado?: EstadoCuenta };

    const clientes = await prisma.cliente.findMany({
      where: q ? { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : undefined,
      include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } },
      orderBy: { nombre: 'asc' },
    });

    let result = clientes.map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
      return {
        id: c.id, nombre: c.nombre, email: c.email, ticketsDisponibles,
        vencimiento: ultimaCompra?.vencimiento ?? null,
        estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
      };
    });

    if (estado) result = result.filter((c) => c.estado === estado);

    res.status(200).json({ clientes: result });
    return;
  }

  if (req.method === 'POST') {
    const { nombre, email, telefono } = req.body as { nombre: string; email: string; telefono?: string };
    const cliente = await prisma.cliente.create({ data: { nombre, email, telefono } });
    res.status(201).json({ cliente });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

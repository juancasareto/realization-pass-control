import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const modalidades = await prisma.modalidad.findMany({ orderBy: { precio: 'asc' } });
    res.status(200).json({ modalidades });
    return;
  }

  if (req.method === 'POST') {
    const { nombre, tipo, conZapas, cantTickets, precio } = req.body;
    const modalidad = await prisma.modalidad.create({ data: { nombre, tipo, conZapas, cantTickets, precio } });
    res.status(201).json({ modalidad });
    return;
  }

  if (req.method === 'PATCH') {
    const { id } = req.query as { id: string };
    const modalidad = await prisma.modalidad.update({ where: { id }, data: req.body });
    res.status(200).json({ modalidad });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

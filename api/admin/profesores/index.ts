import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const profesores = await prisma.profesor.findMany({ orderBy: { nombre: 'asc' } });
    res.status(200).json({ profesores });
    return;
  }

  if (req.method === 'POST') {
    const { nombre } = req.body as { nombre: string };
    const profesor = await prisma.profesor.create({ data: { nombre } });
    res.status(201).json({ profesor });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

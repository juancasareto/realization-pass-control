import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function esDiaDeSeteo(fecha: Date): Promise<boolean> {
  const dia = await prisma.diaExcepcion.findUnique({ where: { fecha: inicioDelDia(fecha) } });
  return dia?.tipo === 'SETEO';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };
    const dias = await prisma.diaExcepcion.findMany({
      where: desde && hasta ? { fecha: { gte: new Date(desde), lte: new Date(hasta) } } : undefined,
      orderBy: { fecha: 'asc' },
    });
    res.status(200).json({ dias });
    return;
  }

  if (req.method === 'POST') {
    const { fecha, tipo, nota } = req.body as { fecha: string; tipo: 'SETEO' | 'FERIADO'; nota?: string };
    const dia = await prisma.diaExcepcion.create({ data: { fecha: inicioDelDia(new Date(fecha)), tipo, nota } });
    res.status(201).json({ dia });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

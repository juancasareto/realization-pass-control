import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { medio, monto, motivo } = req.body as { medio: string; monto: number; motivo: string };
  const retiro = await prisma.retiro.create({ data: { medio: medio as any, monto, motivo, actorId: payload.id } });
  res.status(201).json({ retiro });
}

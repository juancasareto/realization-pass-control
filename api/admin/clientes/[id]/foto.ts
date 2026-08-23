import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, requireRol } from '../../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };
  const { fotoBase64 } = req.body as { fotoBase64: string };

  const match = fotoBase64?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) { res.status(422).json({ error: 'La imagen no tiene un formato válido.' }); return; }

  const [, mime, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');
  const extension = mime.split('/')[1];

  const blob = await put(`clientes/${id}-${Date.now()}.${extension}`, buffer, { access: 'public', contentType: mime });
  await prisma.cliente.update({ where: { id }, data: { fotoUrl: blob.url } });

  res.status(200).json({ fotoUrl: blob.url });
}

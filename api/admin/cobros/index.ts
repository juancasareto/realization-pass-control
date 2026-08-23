import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

const MEDIOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const [pagos, retiros] = await Promise.all([
    prisma.pago.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.retiro.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const cajas = MEDIOS.map((medio) => {
    const entradas = pagos.filter((p) => p.medio === medio).reduce((sum, p) => sum + Number(p.monto), 0);
    const retirado = retiros.filter((r) => r.medio === medio).reduce((sum, r) => sum + Number(r.monto), 0);
    return { medio, entradas, retiros: retirado, saldo: entradas - retirado };
  });

  const movimientos = [
    ...pagos.map((p) => ({ tipo: 'entrada' as const, medio: p.medio, monto: Number(p.monto), motivo: 'Venta de pase', fecha: p.createdAt, actorId: p.clienteId })),
    ...retiros.map((r) => ({ tipo: 'retiro' as const, medio: r.medio, monto: Number(r.monto), motivo: r.motivo, fecha: r.createdAt, actorId: r.actorId })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  res.status(200).json({ cajas, movimientos });
}

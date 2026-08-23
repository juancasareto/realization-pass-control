import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';

type TipoPlan = 'LIBRE' | 'CLASES';

function pickPlanData(body: any) {
  const data: any = {};
  if (body.nombre !== undefined) data.nombre = String(body.nombre).trim();
  if (body.tipo !== undefined) data.tipo = body.tipo as TipoPlan;
  if (body.conZapas !== undefined) data.conZapas = Boolean(body.conZapas);
  if (body.cantTickets !== undefined) data.cantTickets = Number(body.cantTickets);
  if (body.precio !== undefined) data.precio = Number(body.precio);
  if (body.activo !== undefined) data.activo = Boolean(body.activo);
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const modalidades = await prisma.modalidad.findMany({
      include: { _count: { select: { compras: true } } },
      orderBy: [{ activo: 'desc' }, { precio: 'asc' }],
    });
    res.status(200).json({
      modalidades: modalidades.map((m) => ({
        id: m.id, nombre: m.nombre, tipo: m.tipo, conZapas: m.conZapas,
        cantTickets: m.cantTickets, precio: Number(m.precio), activo: m.activo,
        comprasCount: m._count.compras,
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const data = pickPlanData(req.body);
    if (!data.nombre) { res.status(422).json({ error: 'El nombre es obligatorio.' }); return; }
    if (!data.tipo || !['LIBRE', 'CLASES'].includes(data.tipo)) { res.status(422).json({ error: 'Elegí un tipo válido (Libre o Clases).' }); return; }
    if (!Number.isFinite(data.cantTickets) || data.cantTickets < 1) { res.status(422).json({ error: 'La cantidad de tickets debe ser ≥ 1.' }); return; }
    if (!Number.isFinite(data.precio) || data.precio < 0) { res.status(422).json({ error: 'El precio debe ser ≥ 0.' }); return; }

    const modalidad = await prisma.modalidad.create({ data });
    res.status(201).json({ modalidad });
    return;
  }

  if (req.method === 'PATCH') {
    const { id } = req.query as { id: string };
    if (!id) { res.status(422).json({ error: 'Falta el id del plan.' }); return; }

    const data = pickPlanData(req.body);
    if ('cantTickets' in data && (!Number.isFinite(data.cantTickets) || data.cantTickets < 1)) {
      res.status(422).json({ error: 'La cantidad de tickets debe ser ≥ 1.' }); return;
    }
    if ('precio' in data && (!Number.isFinite(data.precio) || data.precio < 0)) {
      res.status(422).json({ error: 'El precio debe ser ≥ 0.' }); return;
    }

    try {
      const modalidad = await prisma.modalidad.update({ where: { id }, data });
      res.status(200).json({ modalidad });
    } catch (err: any) {
      if (err?.code === 'P2025') { res.status(404).json({ error: 'No encontramos ese plan.' }); return; }
      throw err;
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { id } = req.query as { id: string };
    if (!id) { res.status(422).json({ error: 'Falta el id del plan.' }); return; }

    const comprasCount = await prisma.compra.count({ where: { modalidadId: id } });
    if (comprasCount > 0) {
      res.status(409).json({
        error: `No se puede eliminar: hay ${comprasCount} compra(s) asociada(s). Podés desactivarlo en lugar de eliminarlo.`,
      });
      return;
    }

    try {
      await prisma.modalidad.delete({ where: { id } });
      res.status(200).json({ eliminado: true });
    } catch (err: any) {
      if (err?.code === 'P2025') { res.status(404).json({ error: 'No encontramos ese plan.' }); return; }
      throw err;
    }
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

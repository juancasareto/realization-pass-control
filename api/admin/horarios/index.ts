import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  const resource = (req.query?.resource) as string | undefined;

  if (resource === 'profesores') {
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
    return;
  }

  if (req.method === 'GET') {
    const horarios = await prisma.horario.findMany({ include: { profesor: true }, orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }] });
    res.status(200).json({
      horarios: horarios.map((h) => ({
        id: h.id, diaSemana: h.diaSemana, hora: h.hora, tipoClase: h.tipoClase,
        cupoMaximo: h.cupoMaximo, profesorId: h.profesorId, profesorNombre: h.profesor?.nombre ?? null, activo: h.activo,
      })),
    });
    return;
  }

  if (req.method === 'POST') {
    const { diaSemana, hora, tipoClase, cupoMaximo, profesorId } = req.body as {
      diaSemana: number; hora: string; tipoClase: string; cupoMaximo?: number; profesorId?: string;
    };
    const horario = await prisma.horario.create({ data: { diaSemana, hora, tipoClase, cupoMaximo: cupoMaximo ?? 40, profesorId } });
    res.status(201).json({ horario });
    return;
  }

  if (req.method === 'PATCH') {
    const { id } = req.query as { id: string };
    const horario = await prisma.horario.update({ where: { id }, data: req.body });
    res.status(200).json({ horario });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

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
    const body = req.body as {
      diaSemana?: number; dias?: number[]; hora: string; tipoClase: string;
      cupoMaximo?: number; profesorId?: string;
    };

    const dias: number[] = Array.isArray(body.dias) && body.dias.length > 0
      ? body.dias
      : (typeof body.diaSemana === 'number' ? [body.diaSemana] : []);

    if (dias.length === 0) { res.status(422).json({ error: 'Elegí al menos un día.' }); return; }
    if (!body.hora?.trim() || !body.tipoClase?.trim()) {
      res.status(422).json({ error: 'Hora y tipo de clase son obligatorios.' });
      return;
    }

    const creados = await Promise.all(
      dias.map((diaSemana) =>
        prisma.horario.create({
          data: {
            diaSemana, hora: body.hora, tipoClase: body.tipoClase.trim(),
            cupoMaximo: body.cupoMaximo ?? 40, profesorId: body.profesorId || null,
          },
        })
      )
    );

    res.status(201).json({ horarios: creados });
    return;
  }

  if (req.method === 'PATCH') {
    const { id } = req.query as { id: string };
    if (!id) { res.status(422).json({ error: 'Falta el id del horario.' }); return; }

    const body = req.body as {
      diaSemana?: number; hora?: string; tipoClase?: string;
      cupoMaximo?: number; profesorId?: string | null; activo?: boolean;
    };

    const data: any = {};
    if (body.diaSemana !== undefined) data.diaSemana = body.diaSemana;
    if (body.hora !== undefined) data.hora = body.hora;
    if (body.tipoClase !== undefined) data.tipoClase = body.tipoClase.trim();
    if (body.cupoMaximo !== undefined) data.cupoMaximo = body.cupoMaximo;
    if (body.profesorId !== undefined) data.profesorId = body.profesorId || null;
    if (body.activo !== undefined) data.activo = body.activo;

    try {
      const horario = await prisma.horario.update({ where: { id }, data });
      res.status(200).json({ horario });
    } catch (err: any) {
      if (err?.code === 'P2025') { res.status(404).json({ error: 'No encontramos ese horario.' }); return; }
      throw err;
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { id } = req.query as { id: string };
    if (!id) { res.status(422).json({ error: 'Falta el id del horario.' }); return; }

    // Los horarios con reservas asociadas no se pueden borrar, se archivan (activo=false).
    const reservasAsociadas = await prisma.reserva.count({ where: { horarioId: id } });
    if (reservasAsociadas > 0) {
      await prisma.horario.update({ where: { id }, data: { activo: false } });
      res.status(200).json({ archivado: true });
      return;
    }

    try {
      await prisma.horario.delete({ where: { id } });
      res.status(200).json({ eliminado: true });
    } catch (err: any) {
      if (err?.code === 'P2025') { res.status(404).json({ error: 'No encontramos ese horario.' }); return; }
      throw err;
    }
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

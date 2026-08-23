import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        compras: { include: { tickets: true, modalidad: true }, orderBy: { fechaCompra: 'desc' } },
        pagos: { orderBy: { createdAt: 'desc' } },
        reservas: { orderBy: { fechaHora: 'desc' }, take: 30 },
      },
    });

    if (!cliente) { res.status(404).json({ error: 'No encontramos ese alumno.' }); return; }

    const [ausenciasSinAviso, ultimoCheckIn] = await Promise.all([
      prisma.reserva.count({ where: { clienteId: id, estadoAsistencia: 'PENALIZADA' } }),
      prisma.checkIn.findFirst({ where: { clienteId: id }, orderBy: { timestamp: 'desc' } }),
    ]);

    const ultimaCompra = cliente.compras[0] ?? null;
    const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;

    res.status(200).json({
      cliente: {
        id: cliente.id, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono, fotoUrl: cliente.fotoUrl,
        ticketsDisponibles, vencimiento: ultimaCompra?.vencimiento ?? null,
        estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
        clienteDesde: cliente.createdAt, ausenciasSinAviso, ultimaVisita: ultimoCheckIn?.timestamp ?? null,
      },
      compras: cliente.compras,
      pagos: cliente.pagos,
      reservas: cliente.reservas,
    });
    return;
  }

  if (req.method === 'POST') {
    const { fotoBase64 } = req.body as { fotoBase64: string };

    const match = fotoBase64?.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) { res.status(422).json({ error: 'La imagen no tiene un formato válido.' }); return; }

    const [, mime, base64Data] = match;
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mime.split('/')[1];

    const blob = await put(`clientes/${id}-${Date.now()}.${extension}`, buffer, { access: 'public', contentType: mime });
    await prisma.cliente.update({ where: { id }, data: { fotoUrl: blob.url } });

    res.status(200).json({ fotoUrl: blob.url });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta.js';

// Racha de asistencias seguidas: cuenta cuántas reservas consecutivas más recientes
// terminaron en PRESENTE (o RECUPERADA), rompiéndose al primer PENALIZADA / AVISO_AUSENCIA.
// Ignora las PENDIENTES para no penalizar clases todavía no resueltas.
function calcularRacha(reservas: { estadoAsistencia: string; fechaHora: Date }[]): number {
  const ordenadas = [...reservas]
    .filter((r) => ['PRESENTE', 'RECUPERADA', 'PENALIZADA', 'AVISO_AUSENCIA'].includes(r.estadoAsistencia))
    .sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());
  let racha = 0;
  for (const r of ordenadas) {
    if (r.estadoAsistencia === 'PRESENTE' || r.estadoAsistencia === 'RECUPERADA') racha++;
    else break;
  }
  return racha;
}

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
        reservas: { orderBy: { fechaHora: 'desc' }, take: 60 },
      },
    });

    if (!cliente) { res.status(404).json({ error: 'No encontramos ese alumno.' }); return; }

    const [ausenciasSinAviso, ultimoCheckIn] = await Promise.all([
      prisma.reserva.count({ where: { clienteId: id, estadoAsistencia: 'PENALIZADA' } }),
      prisma.checkIn.findFirst({ where: { clienteId: id }, orderBy: { timestamp: 'desc' } }),
    ]);

    const ultimaCompra = cliente.compras[0] ?? null;
    const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
    const racha = calcularRacha(cliente.reservas);

    res.status(200).json({
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        fotoUrl: cliente.fotoUrl,
        fechaNacimiento: cliente.fechaNacimiento,
        direccion: cliente.direccion,
        dni: cliente.dni,
        contactoEmergenciaNombre: cliente.contactoEmergenciaNombre,
        contactoEmergenciaTel: cliente.contactoEmergenciaTel,
        ticketsDisponibles,
        vencimiento: ultimaCompra?.vencimiento ?? null,
        planActual: ultimaCompra?.modalidad?.nombre ?? null,
        estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
        clienteDesde: cliente.createdAt,
        ausenciasSinAviso,
        ultimaVisita: ultimoCheckIn?.timestamp ?? null,
        rachaAsistencias: racha,
      },
      compras: cliente.compras,
      pagos: cliente.pagos,
      reservas: cliente.reservas,
    });
    return;
  }

  if (req.method === 'PATCH') {
    const body = req.body as {
      nombre?: string; email?: string; telefono?: string | null;
      fechaNacimiento?: string | null; direccion?: string | null; dni?: string | null;
      contactoEmergenciaNombre?: string | null; contactoEmergenciaTel?: string | null;
    };

    const data: any = {};
    if (body.nombre !== undefined) data.nombre = body.nombre.trim();
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.telefono !== undefined) data.telefono = body.telefono?.toString().trim() || null;
    if (body.fechaNacimiento !== undefined) data.fechaNacimiento = body.fechaNacimiento ? new Date(body.fechaNacimiento) : null;
    if (body.direccion !== undefined) data.direccion = body.direccion?.toString().trim() || null;
    if (body.dni !== undefined) data.dni = body.dni?.toString().trim() || null;
    if (body.contactoEmergenciaNombre !== undefined) data.contactoEmergenciaNombre = body.contactoEmergenciaNombre?.toString().trim() || null;
    if (body.contactoEmergenciaTel !== undefined) data.contactoEmergenciaTel = body.contactoEmergenciaTel?.toString().trim() || null;

    try {
      const cliente = await prisma.cliente.update({ where: { id }, data });
      res.status(200).json({ cliente });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const campo = err.meta?.target?.[0] === 'dni' ? 'DNI' : 'email';
        res.status(409).json({ error: `Ya existe un alumno con ese ${campo}.` });
        return;
      }
      if (err?.code === 'P2025') {
        res.status(404).json({ error: 'No encontramos ese alumno.' });
        return;
      }
      throw err;
    }
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

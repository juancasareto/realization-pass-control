import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { esDiaDeSeteo } from '../dias-excepcion/index';

const DIAS_VENCIMIENTO = 60;
const OFFSET_ART_HORAS = 3; // Argentina es UTC-3 fijo, sin horario de verano.
const MAX_SEMANAS_A_BUSCAR = 8;

function proximaFecha(diaSemanaISO: number, hora: string, desde: Date): Date {
  const [h, m] = hora.split(':').map(Number);
  const resultado = new Date(desde);
  resultado.setUTCHours(h + OFFSET_ART_HORAS, m, 0, 0);
  const diaActual = resultado.getUTCDay() || 7;
  let delta = diaSemanaISO - diaActual;
  if (delta < 0 || (delta === 0 && resultado.getTime() <= desde.getTime())) delta += 7;
  resultado.setUTCDate(resultado.getUTCDate() + delta);
  return resultado;
}

export async function siguienteFechaHabil(diaSemanaISO: number, hora: string, desde: Date): Promise<Date> {
  let candidata = proximaFecha(diaSemanaISO, hora, desde);
  for (let i = 0; i < MAX_SEMANAS_A_BUSCAR && (await esDiaDeSeteo(candidata)); i++) {
    candidata = new Date(candidata.getTime() + 7 * 86400000);
  }
  return candidata;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { clienteId, modalidadId, medio, descuentoAplicado, horarioId } = req.body as {
    clienteId: string; modalidadId: string; medio: 'MERCADOPAGO' | 'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO';
    descuentoAplicado?: number; horarioId?: string;
  };

  const modalidad = await prisma.modalidad.findUnique({ where: { id: modalidadId } });
  if (!modalidad) { res.status(404).json({ error: 'La modalidad no existe.' }); return; }

  if (modalidad.tipo === 'CLASES' && !horarioId) {
    res.status(422).json({ error: 'Para un plan de Clases hay que elegir un horario fijo.' });
    return;
  }

  const horario = horarioId ? await prisma.horario.findUnique({ where: { id: horarioId } }) : null;
  if (horarioId && !horario) { res.status(404).json({ error: 'El horario no existe.' }); return; }

  const vencimiento = new Date();
  vencimiento.setDate(vencimiento.getDate() + DIAS_VENCIMIENTO);
  const descuento = descuentoAplicado ?? 0;
  const montoFinal = Number(modalidad.precio) * (1 - descuento / 100);

  const compra = await prisma.compra.create({
    data: {
      clienteId, modalidadId, vencimiento, precioPagado: montoFinal,
      tickets: { create: Array.from({ length: modalidad.cantTickets }, () => ({ estado: 'DISPONIBLE' as const })) },
      pago: { create: { clienteId, monto: montoFinal, medio, descuentoAplicado: descuento } },
    },
    include: { tickets: true, pago: true },
  });

  if (horario) {
    let cursor = new Date();
    for (const ticket of compra.tickets) {
      const fechaHora = await siguienteFechaHabil(horario.diaSemana, horario.hora, cursor);
      await prisma.reserva.create({
        data: { clienteId, ticketId: ticket.id, horarioId: horario.id, fechaHora, tipoClase: horario.tipoClase },
      });
      cursor = new Date(fechaHora.getTime() + 1000); // la próxima búsqueda arranca después de ésta
    }
  }

  await prisma.activity.create({
    data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'venta_pase', detalle: { clienteId, modalidadId, compraId: compra.id, medio, descuento, horarioId } },
  });

  res.status(201).json({ compra });
}

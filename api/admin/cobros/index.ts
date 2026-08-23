import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma.js';
import { requireAuth, requireRol } from '../../_lib/auth.js';

const MEDIOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO'] as const;

const CATEGORIAS_INGRESO = ['DIA_SUELTO', 'ALQUILER_MURO', 'OTRO_INGRESO'] as const;
const CATEGORIAS_EGRESO = ['SUELDOS', 'ALQUILER', 'SERVICIOS', 'INSUMOS', 'RETIRO_SOCIOS', 'OTRO_EGRESO'] as const;

type CategoriaIngreso = typeof CATEGORIAS_INGRESO[number];
type CategoriaEgreso = typeof CATEGORIAS_EGRESO[number];

function inicioMes(d: Date) {
  const x = new Date(d);
  x.setDate(1); x.setHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const mesParam = (req.query?.mes) as string | undefined; // formato YYYY-MM
    let desde: Date | undefined;
    let hasta: Date | undefined;
    if (mesParam) {
      const [y, m] = mesParam.split('-').map(Number);
      desde = new Date(Date.UTC(y, m - 1, 1));
      hasta = new Date(Date.UTC(y, m, 1));
    }
    const rangoWhere = desde && hasta ? { gte: desde, lt: hasta } : undefined;

    const [pagos, ingresosManuales, retiros] = await Promise.all([
      prisma.pago.findMany({
        where: rangoWhere ? { createdAt: rangoWhere } : undefined,
        include: { compra: { include: { modalidad: true } }, cliente: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ingresoManual.findMany({
        where: rangoWhere ? { createdAt: rangoWhere } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.retiro.findMany({
        where: rangoWhere ? { createdAt: rangoWhere } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Cajas por medio (sin filtro de mes, siempre saldos totales)
    const [pagosAll, ingresosAll, retirosAll] = rangoWhere
      ? await Promise.all([
          prisma.pago.findMany({ select: { medio: true, monto: true } }),
          prisma.ingresoManual.findMany({ select: { medio: true, monto: true } }),
          prisma.retiro.findMany({ select: { medio: true, monto: true } }),
        ])
      : [pagos, ingresosManuales, retiros];

    const cajas = MEDIOS.map((medio) => {
      const entradasPago = pagosAll.filter((p) => p.medio === medio).reduce((s, p) => s + Number(p.monto), 0);
      const entradasManual = ingresosAll.filter((i) => i.medio === medio).reduce((s, i) => s + Number(i.monto), 0);
      const entradas = entradasPago + entradasManual;
      const salidas = retirosAll.filter((r) => r.medio === medio).reduce((s, r) => s + Number(r.monto), 0);
      return { medio, entradas, retiros: salidas, saldo: entradas - salidas };
    });

    // Movimientos ordenados
    const movimientos = [
      ...pagos.map((p) => ({
        tipo: 'ingreso' as const,
        categoria: 'PLAN',
        medio: p.medio,
        monto: Number(p.monto),
        descripcion: `Plan: ${p.compra?.modalidad?.nombre ?? '—'}`,
        clienteNombre: p.cliente?.nombre ?? null,
        fecha: p.createdAt,
      })),
      ...ingresosManuales.map((i) => ({
        tipo: 'ingreso' as const,
        categoria: i.categoria,
        medio: i.medio,
        monto: Number(i.monto),
        descripcion: i.descripcion ?? '',
        clienteNombre: null,
        fecha: i.createdAt,
      })),
      ...retiros.map((r) => ({
        tipo: 'egreso' as const,
        categoria: r.categoria ?? 'OTRO_EGRESO',
        medio: r.medio,
        monto: Number(r.monto),
        descripcion: r.motivo,
        clienteNombre: null,
        fecha: r.createdAt,
      })),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    // Reporte por categoría
    const porCategoriaIngreso: Record<string, number> = {};
    const porCategoriaEgreso: Record<string, number> = {};
    for (const m of movimientos) {
      const bucket = m.tipo === 'ingreso' ? porCategoriaIngreso : porCategoriaEgreso;
      bucket[m.categoria] = (bucket[m.categoria] ?? 0) + m.monto;
    }
    const totalIngresos = Object.values(porCategoriaIngreso).reduce((s, v) => s + v, 0);
    const totalEgresos = Object.values(porCategoriaEgreso).reduce((s, v) => s + v, 0);

    res.status(200).json({
      cajas,
      movimientos,
      reporte: {
        totalIngresos,
        totalEgresos,
        neto: totalIngresos - totalEgresos,
        porCategoriaIngreso,
        porCategoriaEgreso,
      },
    });
    return;
  }

  if (req.method === 'POST') {
    const accion = (req.query?.accion) as string | undefined;

    // Registrar ingreso manual (día suelto / alquiler muro / otro ingreso)
    if (accion === 'ingreso') {
      const { categoria, medio, monto, descripcion, clienteId } = req.body as {
        categoria: string; medio: string; monto: number; descripcion?: string; clienteId?: string;
      };

      if (!CATEGORIAS_INGRESO.includes(categoria as CategoriaIngreso)) {
        res.status(422).json({ error: 'Categoría de ingreso inválida.' }); return;
      }
      if (!MEDIOS.includes(medio as any)) { res.status(422).json({ error: 'Medio inválido.' }); return; }
      if (!Number.isFinite(monto) || monto <= 0) { res.status(422).json({ error: 'Monto debe ser > 0.' }); return; }

      const ingreso = await prisma.ingresoManual.create({
        data: {
          categoria, medio: medio as any, monto, descripcion: descripcion?.trim() || null,
          clienteId: clienteId || null, actorId: payload.id,
        },
      });
      await prisma.activity.create({
        data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'registrar_ingreso', detalle: { ingresoId: ingreso.id, categoria } },
      });

      res.status(201).json({ ingreso });
      return;
    }

    // Registrar gasto (con categoría)
    if (accion === 'gasto') {
      const { categoria, medio, monto, motivo } = req.body as {
        categoria: string; medio: string; monto: number; motivo: string;
      };

      if (!CATEGORIAS_EGRESO.includes(categoria as CategoriaEgreso)) {
        res.status(422).json({ error: 'Categoría de egreso inválida.' }); return;
      }
      if (!MEDIOS.includes(medio as any)) { res.status(422).json({ error: 'Medio inválido.' }); return; }
      if (!Number.isFinite(monto) || monto <= 0) { res.status(422).json({ error: 'Monto debe ser > 0.' }); return; }
      if (!motivo?.trim()) { res.status(422).json({ error: 'El motivo es obligatorio.' }); return; }

      const retiro = await prisma.retiro.create({
        data: { medio: medio as any, monto, motivo: motivo.trim(), categoria, actorId: payload.id },
      });
      await prisma.activity.create({
        data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'registrar_gasto', detalle: { retiroId: retiro.id, categoria } },
      });

      res.status(201).json({ retiro });
      return;
    }

    // Retro-compat: legacy retiro sin categoría
    const { medio, monto, motivo } = req.body as { medio: string; monto: number; motivo: string };
    const retiro = await prisma.retiro.create({ data: { medio: medio as any, monto, motivo, actorId: payload.id } });
    res.status(201).json({ retiro });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}

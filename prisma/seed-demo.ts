import { prisma } from '../api/_lib/prisma';

// ============================================================================
// Seed de datos DEMO: ~4 meses de historia realista para mostrar la app.
// Este script BORRA todo lo transaccional (clientes, compras, pagos, tickets,
// reservas, check-ins, ingresos manuales, retiros) y lo recrea desde cero.
// El Admin (dani@realization.com) NO se toca.
// ============================================================================

const NOW = new Date();
const DIAS_HISTORIA = 120;
const INICIO_HISTORIA = addDays(NOW, -DIAS_HISTORIA);
const DIAS_VENCIMIENTO = 60; // igual a api/admin/compras/index.ts

const ADMIN_EMAIL = 'dani@realization.com';

// ---------------------------------------------------------------------------
// RNG helpers
// ---------------------------------------------------------------------------
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randChoice<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function chance(pct: number) {
  return Math.random() * 100 < pct;
}
function weightedChoice<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.weight) return it.value;
    r -= it.weight;
  }
  return items[items.length - 1].value;
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function removeAccents(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// Pools de datos argentinos
// ---------------------------------------------------------------------------
const NOMBRES_M = [
  'Juan', 'Martín', 'Santiago', 'Mateo', 'Lucas', 'Nicolás', 'Tomás', 'Facundo',
  'Agustín', 'Franco', 'Ignacio', 'Joaquín', 'Bruno', 'Emiliano', 'Federico',
  'Gonzalo', 'Rodrigo', 'Sebastián', 'Maximiliano', 'Diego', 'Pablo', 'Andrés',
  'Leandro', 'Ezequiel', 'Gabriel', 'Ramiro', 'Iván', 'Matías', 'Julián', 'Nahuel',
];
const NOMBRES_F = [
  'María', 'Sofía', 'Valentina', 'Camila', 'Julieta', 'Martina', 'Agustina',
  'Florencia', 'Lucía', 'Catalina', 'Emilia', 'Milagros', 'Victoria', 'Antonella',
  'Guadalupe', 'Delfina', 'Renata', 'Abril', 'Ornella', 'Micaela', 'Rocío',
  'Carolina', 'Daniela', 'Paula', 'Brenda', 'Yamila', 'Candela', 'Malena', 'Ayelén',
];
const APELLIDOS = [
  'González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez',
  'Pérez', 'García', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz',
  'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Aguirre',
  'Molina', 'Silva', 'Ortiz', 'Núñez', 'Rojas', 'Castro', 'Ibáñez', 'Vega',
  'Domínguez', 'Cabrera', 'Godoy', 'Peralta', 'Luna', 'Correa',
];
const CALLES = [
  'Av. Rivadavia', 'Charcas', 'Av. Cabildo', 'Guardia Vieja', 'Av. Corrientes',
  'Thames', 'Av. Santa Fe', 'Av. Directorio', 'Av. Boedo', 'Av. San Martín',
  'Bonpland', 'Gorriti', 'Av. Juan B. Justo', 'Honduras', 'Av. Independencia',
  'Fitz Roy', 'Av. Warnes', 'Av. Álvarez Jonte',
];

const PROFESORES = ['Martín Aguilar', 'Sofía Benítez', 'Nico Ferreyra'];

type HorarioSeed = { diaSemana: number; hora: string; tipoClase: string; cupoMaximo: number };
const HORARIOS_SEED: HorarioSeed[] = [];
for (let dia = 1; dia <= 5; dia++) {
  HORARIOS_SEED.push({ diaSemana: dia, hora: '08:00', tipoClase: 'Boulder inicial', cupoMaximo: 14 });
  HORARIOS_SEED.push({ diaSemana: dia, hora: '10:00', tipoClase: 'Técnica', cupoMaximo: 10 });
  HORARIOS_SEED.push({ diaSemana: dia, hora: '18:00', tipoClase: 'Boulder intermedio', cupoMaximo: 16 });
  HORARIOS_SEED.push({ diaSemana: dia, hora: '19:30', tipoClase: 'Boulder avanzado', cupoMaximo: 12 });
  HORARIOS_SEED.push({ diaSemana: dia, hora: '21:00', tipoClase: 'Top Rope', cupoMaximo: 10 });
}
HORARIOS_SEED.push({ diaSemana: 6, hora: '10:00', tipoClase: 'Kids', cupoMaximo: 14 });
HORARIOS_SEED.push({ diaSemana: 6, hora: '12:00', tipoClase: 'Boulder inicial', cupoMaximo: 14 });

type ModalidadSeed = {
  nombre: string; tipo: 'LIBRE' | 'CLASES'; conZapas: boolean; cantTickets: number; precio: number; weight: number;
};
const MODALIDADES_SEED: ModalidadSeed[] = [
  { nombre: 'Clase suelta', tipo: 'CLASES', conZapas: true, cantTickets: 1, precio: 6000, weight: 10 },
  { nombre: 'Pase x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000, weight: 35 },
  { nombre: 'Pase x8', tipo: 'CLASES', conZapas: false, cantTickets: 8, precio: 32000, weight: 20 },
  { nombre: 'Pase x12', tipo: 'LIBRE', conZapas: false, cantTickets: 12, precio: 45000, weight: 20 },
  { nombre: 'Libre mensual', tipo: 'LIBRE', conZapas: false, cantTickets: 30, precio: 60000, weight: 15 },
];

const MEDIOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO'] as const;
function medioAleatorio(): typeof MEDIOS[number] {
  return weightedChoice([
    { value: 'EFECTIVO', weight: 30 },
    { value: 'TRANSFERENCIA', weight: 35 },
    { value: 'MERCADOPAGO', weight: 25 },
    { value: 'TARJETA', weight: 10 },
  ]);
}

// ---------------------------------------------------------------------------
// Generador de personas
// ---------------------------------------------------------------------------
const usedEmails = new Set<string>();
const usedDnis = new Set<string>();
const usedNombres = new Set<string>();

function generarPersona() {
  let nombre = '';
  let genero: 'M' | 'F' = 'M';
  do {
    genero = chance(50) ? 'M' : 'F';
    const first = randChoice(genero === 'M' ? NOMBRES_M : NOMBRES_F);
    const last1 = randChoice(APELLIDOS);
    const last2 = randChoice(APELLIDOS);
    nombre = `${first} ${last1} ${last2}`;
  } while (usedNombres.has(nombre));
  usedNombres.add(nombre);

  let emailBase = removeAccents(nombre).toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(0, 2).join('.');
  let email = `${emailBase}@gmail.com`;
  let suffix = 1;
  while (usedEmails.has(email)) {
    email = `${emailBase}${suffix}@gmail.com`;
    suffix++;
  }
  usedEmails.add(email);

  let dni: string;
  do {
    dni = String(randInt(22000000, 45000000));
  } while (usedDnis.has(dni));
  usedDnis.add(dni);

  const telefono = `+54 9 11 ${randInt(4000, 6999)}-${randInt(1000, 9999)}`;
  const contactoTel = `+54 9 11 ${randInt(4000, 6999)}-${randInt(1000, 9999)}`;
  const edad = randInt(16, 55);
  const fechaNacimiento = new Date(NOW.getFullYear() - edad, randInt(0, 11), randInt(1, 28));
  const direccion = `${randChoice(CALLES)} ${randInt(400, 6800)}`;

  const contactoNombre = `${randChoice(genero === 'M' ? NOMBRES_F : NOMBRES_M)} ${randChoice(APELLIDOS)}`;

  return { nombre, email, telefono, dni, fechaNacimiento, direccion, contactoNombre, contactoTel };
}

// ---------------------------------------------------------------------------
// Cálculo de fecha de próxima ocurrencia semanal
// ---------------------------------------------------------------------------
function proximaOcurrenciaSemanal(desde: Date, diaSemanaISO: number, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const resultado = new Date(desde);
  resultado.setHours(h, m, 0, 0);
  const diaActualISO = resultado.getDay() === 0 ? 7 : resultado.getDay();
  let delta = diaSemanaISO - diaActualISO;
  if (delta < 0 || (delta === 0 && resultado.getTime() < desde.getTime())) delta += 7;
  resultado.setDate(resultado.getDate() + delta);
  return resultado;
}

// ---------------------------------------------------------------------------
// Wipe de datos transaccionales (respeta orden de FKs)
// ---------------------------------------------------------------------------
async function wipeTransactionalData() {
  console.log('Borrando datos transaccionales existentes...');
  await prisma.checkIn.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.ingresoManual.deleteMany();
  await prisma.retiro.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.profesor.deleteMany();
  await prisma.modalidad.deleteMany();
  console.log('Listo.');
}

// ---------------------------------------------------------------------------
// Setup: admin, profesores, horarios, modalidades
// ---------------------------------------------------------------------------
async function ensureAdmin() {
  const admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } });
  if (admin) return admin;
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('realization2026', 10);
  return prisma.admin.create({ data: { nombre: 'Dani', email: ADMIN_EMAIL, passwordHash } });
}

async function crearProfesores() {
  const profesores = [];
  for (const nombre of PROFESORES) {
    profesores.push(await prisma.profesor.create({ data: { nombre } }));
  }
  return profesores;
}

async function crearHorarios(profesores: { id: string }[]) {
  const horarios = [];
  for (let i = 0; i < HORARIOS_SEED.length; i++) {
    const h = HORARIOS_SEED[i];
    const profesorId = profesores[i % profesores.length].id;
    horarios.push(await prisma.horario.create({ data: { ...h, profesorId } }));
  }
  return horarios;
}

async function crearModalidades() {
  const modalidades = [];
  for (const m of MODALIDADES_SEED) {
    modalidades.push(await prisma.modalidad.create({
      data: { nombre: m.nombre, tipo: m.tipo, conZapas: m.conZapas, cantTickets: m.cantTickets, precio: m.precio },
    }));
  }
  return modalidades;
}

// ---------------------------------------------------------------------------
// Segmentos de clientes
// ---------------------------------------------------------------------------
type Segmento = 'activo' | 'vencido' | 'semi_inactivo';

function fechaCompraParaSegmento(segmento: Segmento, modalidad?: ModalidadSeed): Date {
  if (segmento === 'activo') {
    // Duración estimada del plan en días antes de agotar tickets, con margen
    // para que al día de hoy todavía le queden clases/tickets sin consumir.
    const duracionEstimada = modalidad
      ? modalidad.tipo === 'CLASES'
        ? modalidad.cantTickets * 7 // una clase por semana
        : Math.round((modalidad.cantTickets / 2.2) * 7) // ritmo de uso tipo gimnasio (~2.2/semana)
      : 55;
    const maxDiasAtras = Math.max(3, Math.min(55, duracionEstimada - randInt(5, 12)));
    return addDays(NOW, -randInt(0, maxDiasAtras));
  }
  if (segmento === 'vencido') return addDays(NOW, -randInt(61, 90));
  return addDays(NOW, -randInt(100, 119)); // semi_inactivo
}

// ---------------------------------------------------------------------------
// Generación de reservas históricas para una compra CLASES
// ---------------------------------------------------------------------------
type ContextoCompra = {
  clienteId: string;
  compraId: string;
  fechaCompra: Date;
  cantTickets: number;
  horario: { id: string; diaSemana: number; hora: string; tipoClase: string };
  detenerTemprano?: boolean; // para semi_inactivo: dejar de generar ocurrencias tras pocas semanas
};

async function generarReservasClases(ctx: ContextoCompra) {
  const tickets = [];
  for (let i = 0; i < ctx.cantTickets; i++) {
    tickets.push(await prisma.ticket.create({ data: { compraId: ctx.compraId, estado: 'DISPONIBLE' } }));
  }

  const primeraOcurrencia = proximaOcurrenciaSemanal(ctx.fechaCompra, ctx.horario.diaSemana, ctx.horario.hora);
  const limiteOcurrencias = ctx.detenerTemprano ? Math.min(ctx.cantTickets, randInt(2, 4)) : ctx.cantTickets;

  let checkInsCreados = 0;
  let ultimaVisita: Date | null = null;

  for (let i = 0; i < limiteOcurrencias; i++) {
    const fecha = addDays(primeraOcurrencia, i * 7);
    const ticket = tickets[i];

    if (fecha > NOW) {
      await prisma.reserva.create({
        data: {
          clienteId: ctx.clienteId, ticketId: ticket.id, horarioId: ctx.horario.id,
          fechaHora: fecha, tipoClase: ctx.horario.tipoClase, estadoAsistencia: 'PENDIENTE',
        },
      });
      continue;
    }

    const diasAtras = (NOW.getTime() - fecha.getTime()) / 86400000;

    if (diasAtras <= 7) {
      // Clase reciente: a veces todavía no se marcó (alimenta "faltas pendientes de recuperar")
      if (chance(45)) {
        await prisma.reserva.create({
          data: {
            clienteId: ctx.clienteId, ticketId: ticket.id, horarioId: ctx.horario.id,
            fechaHora: fecha, tipoClase: ctx.horario.tipoClase, estadoAsistencia: 'PENDIENTE',
          },
        });
        continue;
      }
    }

    // Clase resuelta: distribución realista de asistencia
    const outcome = weightedChoice([
      { value: 'PRESENTE' as const, weight: 85 },
      { value: 'AVISO_AUSENCIA' as const, weight: 8 },
      { value: 'PENALIZADA' as const, weight: 7 },
    ]);

    if (outcome === 'PRESENTE') {
      const reserva = await prisma.reserva.create({
        data: {
          clienteId: ctx.clienteId, ticketId: ticket.id, horarioId: ctx.horario.id,
          fechaHora: fecha, tipoClase: ctx.horario.tipoClase, estadoAsistencia: 'PRESENTE',
        },
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { estado: 'CONSUMIDO', consumidoAt: fecha } });
      await prisma.checkIn.create({ data: { clienteId: ctx.clienteId, reservaId: reserva.id, timestamp: fecha, metodo: 'MANUAL' } });
      checkInsCreados++;
      if (!ultimaVisita || fecha > ultimaVisita) ultimaVisita = fecha;
    } else if (outcome === 'AVISO_AUSENCIA') {
      await prisma.reserva.create({
        data: {
          clienteId: ctx.clienteId, ticketId: null, horarioId: ctx.horario.id,
          fechaHora: fecha, tipoClase: ctx.horario.tipoClase, estadoAsistencia: 'AVISO_AUSENCIA',
        },
      });
      // el ticket queda DISPONIBLE (se liberó, no se consumió)
    } else {
      await prisma.reserva.create({
        data: {
          clienteId: ctx.clienteId, ticketId: ticket.id, horarioId: ctx.horario.id,
          fechaHora: fecha, tipoClase: ctx.horario.tipoClase, estadoAsistencia: 'PENALIZADA',
        },
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { estado: 'PENALIZADO' } });
    }
  }

  return { checkInsCreados, ultimaVisita };
}

// ---------------------------------------------------------------------------
// Generación de check-ins históricos para una compra LIBRE (uso tipo gimnasio)
// ---------------------------------------------------------------------------
async function generarCheckInsLibre(ctx: { clienteId: string; compraId: string; fechaCompra: Date; cantTickets: number; vencimiento: Date }) {
  const tickets = [];
  for (let i = 0; i < ctx.cantTickets; i++) {
    tickets.push(await prisma.ticket.create({ data: { compraId: ctx.compraId, estado: 'DISPONIBLE' } }));
  }

  const finVentana = ctx.vencimiento < NOW ? ctx.vencimiento : NOW;
  const diasDisponibles = Math.max(0, Math.floor((finVentana.getTime() - ctx.fechaCompra.getTime()) / 86400000));
  // Frecuencia de uso tipo gimnasio: ~2 visitas por semana, acotado por tickets disponibles
  const visitasEstimadas = Math.min(ctx.cantTickets, Math.round((diasDisponibles / 7) * randInt(15, 25) / 10));

  const diasUsados = new Set<number>();
  let intentos = 0;
  let ultimaVisita: Date | null = null;
  let checkInsCreados = 0;

  while (diasUsados.size < visitasEstimadas && intentos < visitasEstimadas * 6) {
    intentos++;
    const offset = randInt(0, diasDisponibles);
    if (diasUsados.has(offset)) continue;
    diasUsados.add(offset);

    const fecha = addDays(ctx.fechaCompra, offset);
    fecha.setHours(randInt(9, 21), randChoice([0, 15, 30, 45]), 0, 0);
    if (fecha > NOW) continue;

    const ticket = tickets[checkInsCreados];
    if (!ticket) break;

    const reserva = await prisma.reserva.create({
      data: {
        clienteId: ctx.clienteId, ticketId: ticket.id, horarioId: null,
        fechaHora: fecha, tipoClase: 'Libre', estadoAsistencia: 'PRESENTE',
      },
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { estado: 'CONSUMIDO', consumidoAt: fecha } });
    await prisma.checkIn.create({ data: { clienteId: ctx.clienteId, reservaId: reserva.id, timestamp: fecha, metodo: 'MANUAL' } });
    checkInsCreados++;
    if (!ultimaVisita || fecha > ultimaVisita) ultimaVisita = fecha;
  }

  return { checkInsCreados, ultimaVisita };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export async function runDemoSeed() {
  const admin = await ensureAdmin();
  await wipeTransactionalData();

  console.log('Creando profesores, horarios y modalidades...');
  const profesores = await crearProfesores();
  const horarios = await crearHorarios(profesores);
  const modalidades = await crearModalidades();
  const modalidadesClases = modalidades.filter((m) => m.tipo === 'CLASES');
  const modalidadesLibre = modalidades.filter((m) => m.tipo === 'LIBRE');
  const horariosClases = horarios; // todos sirven para CLASES

  const modalidadWeighted = MODALIDADES_SEED.map((m, i) => ({ value: modalidades[i], weight: m.weight }));

  console.log('Generando 80 alumnos con historial de 4 meses...');

  const segmentos: Segmento[] = [
    ...Array(50).fill('activo'),
    ...Array(20).fill('vencido'),
    ...Array(10).fill('semi_inactivo'),
  ];

  const clasesCompraPairs: { clienteId: string; compraId: string; horario: typeof horarios[number] }[] = [];
  let totalCompras = 0;
  let totalPagos = 0;
  let totalReservas = 0;
  let totalCheckIns = 0;

  const clientesConContexto: { clienteId: string; segmento: Segmento; horario: typeof horarios[number] | null }[] = [];

  for (const segmento of shuffle(segmentos)) {
    const persona = generarPersona();
    const cliente = await prisma.cliente.create({
      data: {
        nombre: persona.nombre,
        email: persona.email,
        telefono: persona.telefono,
        dni: persona.dni,
        fechaNacimiento: persona.fechaNacimiento,
        direccion: persona.direccion,
        contactoEmergenciaNombre: persona.contactoNombre,
        contactoEmergenciaTel: persona.contactoTel,
        createdAt: addDays(fechaCompraParaSegmento(segmento), -randInt(0, 5)),
      },
    });

    // Modalidad de la compra ACTUAL (vigente hoy): se elige antes de la fecha
    // para poder acotar la antigüedad y garantizar que le queden tickets/clases
    // sin consumir cuando el segmento es "activo" (si no, un Pase x4 comprado
    // hace 55 días ya agotó sus 4 clases semanales y queda "vencido" por
    // agotamiento aunque la fecha de vencimiento siga vigente).
    const modalidadActual = weightedChoice(modalidadWeighted);
    const modalidadActualData = MODALIDADES_SEED.find((m) => m.nombre === modalidadActual.nombre)!;
    const fechaActual = fechaCompraParaSegmento(segmento, modalidadActualData);

    const tieneRenovacion = segmento !== 'semi_inactivo' && chance(30) && addDays(fechaActual, -65) >= INICIO_HISTORIA;
    const modalidadRenovacion = tieneRenovacion ? weightedChoice(modalidadWeighted) : null;

    const fechasCompra: { fecha: Date; modalidad: typeof modalidadActual }[] = tieneRenovacion
      ? [{ fecha: addDays(fechaActual, -randInt(65, 90)), modalidad: modalidadRenovacion! }, { fecha: fechaActual, modalidad: modalidadActual }]
      : [{ fecha: fechaActual, modalidad: modalidadActual }];

    let horarioAsignado: typeof horarios[number] | null = null;

    for (let idx = 0; idx < fechasCompra.length; idx++) {
      const { fecha: fechaCompra, modalidad } = fechasCompra[idx];
      const esUltima = idx === fechasCompra.length - 1;
      const modalidadSeedData = MODALIDADES_SEED.find((m) => m.nombre === modalidad.nombre)!;
      const vencimiento = addDays(fechaCompra, DIAS_VENCIMIENTO);
      const medio = medioAleatorio();
      const descuento = chance(15) ? randChoice([5, 10, 15]) : 0;
      const precioFinal = Number(modalidad.precio) * (1 - descuento / 100);

      const compra = await prisma.compra.create({
        data: {
          clienteId: cliente.id, modalidadId: modalidad.id, fechaCompra, vencimiento, precioPagado: precioFinal,
        },
      });
      await prisma.pago.create({
        data: { clienteId: cliente.id, compraId: compra.id, monto: precioFinal, medio, descuentoAplicado: descuento, createdAt: fechaCompra },
      });
      totalCompras++;
      totalPagos++;

      if (modalidadSeedData.tipo === 'CLASES') {
        const horario: typeof horarios[number] = idx === 0 ? randChoice(horariosClases) : (horarioAsignado ?? randChoice(horariosClases));
        horarioAsignado = horario;
        const { checkInsCreados } = await generarReservasClases({
          clienteId: cliente.id,
          compraId: compra.id,
          fechaCompra,
          cantTickets: modalidadSeedData.cantTickets,
          horario,
          detenerTemprano: segmento === 'semi_inactivo',
        });
        totalCheckIns += checkInsCreados;
        totalReservas += modalidadSeedData.cantTickets;
        if (esUltima) clasesCompraPairs.push({ clienteId: cliente.id, compraId: compra.id, horario });
      } else {
        const { checkInsCreados } = await generarCheckInsLibre({
          clienteId: cliente.id, compraId: compra.id, fechaCompra,
          cantTickets: modalidadSeedData.cantTickets, vencimiento,
        });
        totalCheckIns += checkInsCreados;
        totalReservas += checkInsCreados;
      }
    }

    clientesConContexto.push({ clienteId: cliente.id, segmento, horario: horarioAsignado });
  }

  console.log(`Alumnos: 80, compras: ${totalCompras}, pagos: ${totalPagos}, reservas: ~${totalReservas}, check-ins: ${totalCheckIns}`);

  // -------------------------------------------------------------------------
  // Flavor: algunas recuperaciones (RECUPERADA) para variedad visual
  // -------------------------------------------------------------------------
  console.log('Agregando recuperos de ejemplo...');
  const paresParaRecupero = shuffle(clasesCompraPairs).slice(0, 10);
  for (const par of paresParaRecupero) {
    const fechaFalta = addDays(NOW, -randInt(3, 7));
    if (fechaFalta < INICIO_HISTORIA) continue;
    const fechaRecupero = addDays(fechaFalta, randInt(1, 2));
    if (fechaRecupero > NOW) continue;

    const otroHorario = randChoice(horarios);
    const extraTicket = await prisma.ticket.create({ data: { compraId: par.compraId, estado: 'CONSUMIDO', consumidoAt: fechaRecupero } });

    const original = await prisma.reserva.create({
      data: {
        clienteId: par.clienteId, ticketId: null, horarioId: par.horario.id,
        fechaHora: fechaFalta, tipoClase: par.horario.tipoClase, estadoAsistencia: 'RECUPERADA',
      },
    });
    const recupero = await prisma.reserva.create({
      data: {
        clienteId: par.clienteId, ticketId: extraTicket.id, horarioId: otroHorario.id,
        fechaHora: fechaRecupero, tipoClase: otroHorario.tipoClase, estadoAsistencia: 'PRESENTE',
        recuperaDeId: original.id,
      },
    });
    await prisma.checkIn.create({ data: { clienteId: par.clienteId, reservaId: recupero.id, timestamp: fechaRecupero, metodo: 'MANUAL' } });
  }

  // -------------------------------------------------------------------------
  // Garantizar actividad de HOY para que el dashboard se vea vivo
  // -------------------------------------------------------------------------
  console.log('Garantizando actividad de hoy...');
  const activos = clientesConContexto.filter((c) => c.segmento === 'activo' && c.horario);
  const paraHoyPendiente = shuffle(activos).slice(0, 4);
  const paraHoyPresente = shuffle(activos).slice(4, 7);
  const paraFaltaPendiente = shuffle(activos).slice(7, 9);
  const paraCompraHoy = shuffle(activos).slice(9, 11);

  for (const c of paraHoyPendiente) {
    const compraAbierta = await prisma.compra.findFirst({ where: { clienteId: c.clienteId }, orderBy: { fechaCompra: 'desc' } });
    if (!compraAbierta) continue;
    const ticket = await prisma.ticket.create({ data: { compraId: compraAbierta.id, estado: 'DISPONIBLE' } });
    const horaHoy = new Date(NOW);
    horaHoy.setHours(randInt(18, 21), 0, 0, 0);
    await prisma.reserva.create({
      data: {
        clienteId: c.clienteId, ticketId: ticket.id, horarioId: c.horario!.id,
        fechaHora: horaHoy, tipoClase: c.horario!.tipoClase, estadoAsistencia: 'PENDIENTE',
      },
    });
  }

  for (const c of paraHoyPresente) {
    const compraAbierta = await prisma.compra.findFirst({ where: { clienteId: c.clienteId }, orderBy: { fechaCompra: 'desc' } });
    if (!compraAbierta) continue;
    const ticket = await prisma.ticket.create({ data: { compraId: compraAbierta.id, estado: 'CONSUMIDO', consumidoAt: NOW } });
    const horaHoy = new Date(NOW);
    horaHoy.setHours(randInt(8, 12), randChoice([0, 15, 30, 45]), 0, 0);
    if (horaHoy > NOW) horaHoy.setHours(NOW.getHours() - 1);
    const reserva = await prisma.reserva.create({
      data: {
        clienteId: c.clienteId, ticketId: ticket.id, horarioId: c.horario!.id,
        fechaHora: horaHoy, tipoClase: c.horario!.tipoClase, estadoAsistencia: 'PRESENTE',
      },
    });
    await prisma.checkIn.create({ data: { clienteId: c.clienteId, reservaId: reserva.id, timestamp: horaHoy, metodo: 'MANUAL' } });
  }

  for (const c of paraFaltaPendiente) {
    const compraAbierta = await prisma.compra.findFirst({ where: { clienteId: c.clienteId }, orderBy: { fechaCompra: 'desc' } });
    if (!compraAbierta) continue;
    const ticket = await prisma.ticket.create({ data: { compraId: compraAbierta.id, estado: 'DISPONIBLE' } });
    const fechaPasada = addDays(NOW, -randInt(2, 5));
    fechaPasada.setHours(19, 0, 0, 0);
    await prisma.reserva.create({
      data: {
        clienteId: c.clienteId, ticketId: ticket.id, horarioId: c.horario!.id,
        fechaHora: fechaPasada, tipoClase: c.horario!.tipoClase, estadoAsistencia: 'PENDIENTE',
      },
    });
  }

  for (const c of paraCompraHoy) {
    const modalidad = randChoice(modalidadesClases.length > 0 ? modalidadesClases : modalidades);
    const modalidadSeedData = MODALIDADES_SEED.find((m) => m.nombre === modalidad.nombre)!;
    const vencimiento = addDays(NOW, DIAS_VENCIMIENTO);
    const medio = medioAleatorio();
    const compra = await prisma.compra.create({
      data: { clienteId: c.clienteId, modalidadId: modalidad.id, fechaCompra: NOW, vencimiento, precioPagado: modalidad.precio },
    });
    await prisma.pago.create({ data: { clienteId: c.clienteId, compraId: compra.id, monto: modalidad.precio, medio, createdAt: NOW } });
    for (let i = 0; i < modalidadSeedData.cantTickets; i++) {
      await prisma.ticket.create({ data: { compraId: compra.id, estado: 'DISPONIBLE' } });
    }
  }

  // -------------------------------------------------------------------------
  // Ingresos manuales (día suelto walk-ins, alquiler de muro, otros)
  // -------------------------------------------------------------------------
  console.log('Generando ingresos manuales...');
  let totalIngresosManuales = 0;
  const diasSueltoCount = randInt(30, 40);
  for (let i = 0; i < diasSueltoCount; i++) {
    const fecha = addDays(INICIO_HISTORIA, randInt(0, DIAS_HISTORIA));
    if (fecha > NOW) continue;
    fecha.setHours(randInt(9, 21), 0, 0, 0);
    await prisma.ingresoManual.create({
      data: {
        categoria: 'DIA_SUELTO', medio: medioAleatorio(), monto: randInt(3000, 5000),
        descripcion: 'Día suelto — visitante ocasional', actorId: admin.id, createdAt: fecha,
      },
    });
    totalIngresosManuales++;
  }

  const alquilerMuroCount = randInt(5, 8);
  for (let i = 0; i < alquilerMuroCount; i++) {
    const fecha = addDays(INICIO_HISTORIA, randInt(0, DIAS_HISTORIA));
    if (fecha > NOW) continue;
    fecha.setHours(randInt(10, 20), 0, 0, 0);
    await prisma.ingresoManual.create({
      data: {
        categoria: 'ALQUILER_MURO', medio: 'TRANSFERENCIA', monto: randInt(15000, 30000),
        descripcion: 'Alquiler de muro — evento privado', actorId: admin.id, createdAt: fecha,
      },
    });
    totalIngresosManuales++;
  }

  const otroIngresoCount = randInt(3, 5);
  for (let i = 0; i < otroIngresoCount; i++) {
    const fecha = addDays(INICIO_HISTORIA, randInt(0, DIAS_HISTORIA));
    if (fecha > NOW) continue;
    await prisma.ingresoManual.create({
      data: {
        categoria: 'OTRO_INGRESO', medio: medioAleatorio(), monto: randInt(2000, 10000),
        descripcion: 'Venta de merchandising', actorId: admin.id, createdAt: fecha,
      },
    });
    totalIngresosManuales++;
  }

  // -------------------------------------------------------------------------
  // Gastos (Retiro con categoría)
  // -------------------------------------------------------------------------
  console.log('Generando gastos...');
  let totalGastos = 0;
  const meses = Math.ceil(DIAS_HISTORIA / 30);

  for (let mes = 0; mes < meses; mes++) {
    const inicioMes = addDays(INICIO_HISTORIA, mes * 30);

    // Sueldos: 2 por mes
    for (let i = 0; i < 2; i++) {
      const fecha = addDays(inicioMes, randInt(0, 29));
      if (fecha > NOW) continue;
      await prisma.retiro.create({
        data: {
          medio: weightedChoice([{ value: 'TRANSFERENCIA' as const, weight: 65 }, { value: 'EFECTIVO' as const, weight: 35 }]),
          monto: randInt(90000, 135000), motivo: 'Pago de sueldo',
          categoria: 'SUELDOS', actorId: admin.id, createdAt: fecha,
        },
      });
      totalGastos++;
    }

    // Alquiler: 1 por mes
    {
      const fecha = addDays(inicioMes, randInt(0, 5));
      if (fecha <= NOW) {
        await prisma.retiro.create({
          data: {
            medio: weightedChoice([{ value: 'TRANSFERENCIA' as const, weight: 65 }, { value: 'EFECTIVO' as const, weight: 35 }]),
            monto: randInt(100000, 150000), motivo: 'Alquiler del local',
            categoria: 'ALQUILER', actorId: admin.id, createdAt: fecha,
          },
        });
        totalGastos++;
      }
    }

    // Servicios: 2-3 por mes
    const serviciosCount = randInt(2, 3);
    for (let i = 0; i < serviciosCount; i++) {
      const fecha = addDays(inicioMes, randInt(0, 29));
      if (fecha > NOW) continue;
      await prisma.retiro.create({
        data: {
          medio: medioAleatorio(), monto: randInt(12000, 25000),
          motivo: randChoice(['Luz', 'Gas', 'Internet', 'Agua']),
          categoria: 'SERVICIOS', actorId: admin.id, createdAt: fecha,
        },
      });
      totalGastos++;
    }

    // Insumos: 3-5 por mes
    const insumosCount = randInt(3, 5);
    for (let i = 0; i < insumosCount; i++) {
      const fecha = addDays(inicioMes, randInt(0, 29));
      if (fecha > NOW) continue;
      await prisma.retiro.create({
        data: {
          medio: randChoice(['EFECTIVO', 'TARJETA']), monto: randInt(8000, 22000),
          motivo: randChoice(['Magnesio', 'Cintas de agarre', 'Mantenimiento de presas', 'Limpieza', 'Botiquín']),
          categoria: 'INSUMOS', actorId: admin.id, createdAt: fecha,
        },
      });
      totalGastos++;
    }

    // Retiro de socios: 1-2 por mes
    const retiroSociosCount = randInt(1, 2);
    for (let i = 0; i < retiroSociosCount; i++) {
      const fecha = addDays(inicioMes, randInt(0, 29));
      if (fecha > NOW) continue;
      await prisma.retiro.create({
        data: {
          medio: randChoice(['EFECTIVO', 'TRANSFERENCIA']), monto: randInt(15000, 35000),
          motivo: 'Retiro de socios', categoria: 'RETIRO_SOCIOS', actorId: admin.id, createdAt: fecha,
        },
      });
      totalGastos++;
    }
  }

  console.log('---');
  console.log('Seed demo completo.');
  console.log(`Alumnos: 80 | Compras: ${totalCompras} | Ingresos manuales: ${totalIngresosManuales} | Gastos: ${totalGastos}`);
  console.log(`Profesores: ${profesores.length} | Horarios: ${horarios.length} | Planes: ${modalidades.length}`);
}

runDemoSeed()
  .then(() => prisma.$disconnect())
  .catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });

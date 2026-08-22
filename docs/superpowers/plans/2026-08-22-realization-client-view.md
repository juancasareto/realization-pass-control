# Realization Client View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Sequencing:** execute this plan AFTER `2026-08-22-realization-admin-view.md`. Every task below assumes the Prisma schema, auth lib, and `Cliente`/`Compra`/`Ticket`/`Reserva`/`CheckIn` data already exist and are being populated by the Admin app (Dani sells pases, registers reservas, marks check-ins). This plan does not touch `/api/admin/**` or `src/pages/*Admin*` — it only adds a `CLIENTE`-facing surface.

**Goal:** Build the mobile-first Client app — the screen an alumno opens 30 times a week to see their saldo, their next class, their attendance streak, and their history.

**Architecture:** A second Vite + React 18 + TS SPA, deployed as its own Vercel project (`realization-client`) sharing the same `/api` backend and Prisma schema as the Admin project (both read/write the same Neon database; the Client project's `vercel.json` proxies `/api/*` to the Admin project's deployment URL, or — simpler for v1 — the Client app is added as a second app inside the same repo/Vercel project under a different route prefix; pick one at Task 1 time based on what Vercel's monorepo support looks like then, this plan works either way since it only depends on the API contracts, not on where they're hosted).

**Tech Stack:** Same as the Admin plan — React 18, Vite, TypeScript, Tailwind CSS v4, React Router, Express-style Vercel functions, Prisma, JWT, Vitest + React Testing Library, Vitest + Supertest.

## Global Constraints

- **One screen, no tabs, no side menu** — the home screen is a single scrollable page. Secondary info (full purchase history) can be a second route, but saldo/streak/next-class/recent-history all live on one screen.
- **Mobile-first** — design and test at a 375px viewport first; desktop is a bonus, not a target.
- **Brand tokens identical to the Admin plan** — same hex values, same fonts, same sharp-corners-no-icons rule. Reference: `shared/brand/brand-manual.html`.
- **Racha (streak) is the only gamification in v1** — no XP, no badges, no leaderboard, no themed progress bar. This was an explicit scope cut; do not re-add anything from that list without the user asking again.
- **QR/GPS check-in is out of scope for this plan too** — the client's "fichar" action in v1 is informational only (it shows the state described in Task 5), the actual check-in event is still created by Dani's manual override in the Admin app (already built). Do not build camera or geolocation code here.
- **The 24-hour no-show rule is owned by this plan** (it didn't fit the Admin plan since it depends on client-created reservations, which don't exist yet at that point) — Task 6 below.
- **Copy and error-message rules are identical to the Admin plan's voice section** — no raw error codes, name what the person sees.

---

## File Structure

```
realization-pass-control/
├── api/
│   ├── cliente/
│   │   ├── me.ts               # GET saldo + racha + proxima clase
│   │   ├── historial.ts        # GET checkins + tickets consumidos, paginado
│   │   └── avisar-ausencia.ts  # POST marca aviso24hs en una reserva propia
│   └── cron/
│       └── penalizar-no-shows.ts  # nightly cron, Vercel Cron Jobs
├── client/                      # second Vite app (or route prefix — see Architecture)
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   ├── apiClient.ts        # same contract as the admin one, separate copy (no shared package yet — YAGNI)
│   │   │   └── AuthContext.tsx
│   │   ├── components/
│   │   │   ├── SaldoCard.tsx
│   │   │   ├── RachaTag.tsx
│   │   │   └── HistorialItem.tsx
│   │   └── pages/
│   │       ├── ClienteLoginPage.tsx
│   │       └── ClienteHomePage.tsx
├── tests/
│   ├── api/cliente/
│   └── client/src/
├── client/vite.config.ts
└── client/vercel.json
```

---

### Task 1: Cliente auth — activar cuenta + login

**Files:**
- Modify: `prisma/schema.prisma` (add `passwordHash String?` to `Cliente`)
- Create: `api/cliente/activar.ts`, `api/cliente/login.ts`
- Create: `client/` Vite scaffold (`index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`)
- Create: `client/src/lib/apiClient.ts`, `client/src/lib/AuthContext.tsx`, `client/src/pages/ClienteLoginPage.tsx`
- Test: `tests/api/cliente/activar.test.ts`, `tests/api/cliente/login.test.ts`

**Interfaces:**
- Consumes: `Cliente` model (Admin plan Task 2), `signToken`/`verifyToken` (Admin plan Task 3) — reused as-is, `rol: 'CLIENTE'`.
- Produces: `POST /api/cliente/activar` body `{ email, password }` — sets `passwordHash` on an existing `Cliente` row created by Dani in the Admin app (a cliente must already exist by email; this endpoint does not create new clientes). `POST /api/cliente/login` — same shape as the admin login, returns `{ token, nombre }` with `rol: 'CLIENTE'`. Every later Task 2-5 endpoint reads `payload.id` as the `clienteId`.

- [ ] **Step 1: Add passwordHash to Cliente and migrate**

```prisma
// prisma/schema.prisma — modify the Cliente model
model Cliente {
  id           String    @id @default(cuid())
  nombre       String
  email        String    @unique
  telefono     String?
  passwordHash String?
  createdAt    DateTime  @default(now())
  compras      Compra[]
  reservas     Reserva[]
  checkIns     CheckIn[]
  pagos        Pago[]
}
```

Run: `npx prisma migrate dev --name add_cliente_password`
Expected: migration applies cleanly.

- [ ] **Step 2: Write the failing test for activar**

```typescript
// tests/api/cliente/activar.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../../api/_lib/prisma';
import handler from '../../../api/cliente/activar';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/cliente/activar', () => {
  beforeAll(async () => {
    await prisma.cliente.create({
      data: { nombre: 'Activar Test', email: 'activar-test@realization.com' },
    });
  });

  afterAll(async () => {
    await prisma.cliente.delete({ where: { email: 'activar-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('sets a passwordHash for an existing cliente by email', async () => {
    const req: any = { method: 'POST', body: { email: 'activar-test@realization.com', password: 'miClave123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const cliente = await prisma.cliente.findUnique({ where: { email: 'activar-test@realization.com' } });
    expect(cliente?.passwordHash).not.toBeNull();
  });

  it('returns 404 for an email Dani never registered', async () => {
    const req: any = { method: 'POST', body: { email: 'no-existe@realization.com', password: 'x' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/api/cliente/activar.test.ts`
Expected: FAIL with "Cannot find module '../../../api/cliente/activar'"

- [ ] **Step 4: Implement activar and login**

```typescript
// api/cliente/activar.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { prisma } from '../_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };
  const cliente = await prisma.cliente.findUnique({ where: { email } });

  if (!cliente) {
    res.status(404).json({ error: 'No encontramos ese email. Pedile a Dani que te dé de alta primero.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.cliente.update({ where: { email }, data: { passwordHash } });
  res.status(200).json({ ok: true });
}
```

```typescript
// api/cliente/login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { prisma } from '../_lib/prisma';
import { signToken } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };
  const cliente = await prisma.cliente.findUnique({ where: { email } });

  if (!cliente?.passwordHash || !(await bcrypt.compare(password, cliente.passwordHash))) {
    res.status(401).json({ error: 'Email o contraseña incorrectos.' });
    return;
  }

  const token = signToken({ id: cliente.id, rol: 'CLIENTE' });
  res.status(200).json({ token, nombre: cliente.nombre });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/cliente/activar.test.ts tests/api/cliente/login.test.ts`
Expected: PASS (write `login.test.ts` mirroring the Admin plan's `login.test.ts` structure, asserting `payload.rol === 'CLIENTE'`)

- [ ] **Step 6: Scaffold the client Vite app**

Reuse Task 1 of the Admin plan verbatim, but under `client/` instead of the repo root, with `<title>Realization</title>` and the app name "Realization" instead of "Realization Admin" in its smoke test. Point `client/vite.config.ts`'s `root` at `client/` if kept in the same repo, or run `npm create vite@latest client -- --template react-ts` if it's cleaner to init standalone — either way it must end up with the same `src/lib/apiClient.ts` contract (`apiFetch(path, options, token)`) as the Admin app, copied rather than shared (no monorepo package extraction yet — YAGNI until there's a second consumer that isn't Admin/Client).

- [ ] **Step 7: Build ClienteLoginPage (mirrors Admin's LoginPage, posts to /api/cliente/login)**

```typescript
// client/src/pages/ClienteLoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function ClienteLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="font-['Anton'] uppercase text-3xl mb-6 text-center">Realization</h1>
        {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-3 text-[var(--chalk)]"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-3 text-[var(--chalk)]"
        />
        <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-4">
          Entrar
        </button>
      </form>
    </div>
  );
}
```

`AuthContext.tsx` and `apiClient.ts` are identical in shape to the Admin plan's Task 3 versions, pointed at `/api/cliente/login` instead of `/api/auth/login`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma api/cliente/activar.ts api/cliente/login.ts client/ tests/
git commit -m "feat: cliente auth (activar cuenta + login) and client app scaffold"
```

---

### Task 2: Saldo — GET /api/cliente/me

**Files:**
- Create: `api/cliente/me.ts`, `client/src/components/SaldoCard.tsx`, `client/src/pages/ClienteHomePage.tsx`
- Test: `tests/api/cliente/me.test.ts`

**Interfaces:**
- Consumes: `calcularEstadoCuenta` from `api/_lib/estadoCuenta.ts` (Admin plan Task 4, reused verbatim), `requireAuth` (Admin plan Task 3).
- Produces: `GET /api/cliente/me` → `{ nombre, ticketsDisponibles, ticketsTotales, vencimiento, estado, modalidadNombre, proximaClase: { fechaHora, tipoClase, confirmada } | null }`. Task 3 (racha) and Task 5 (historial) are separate endpoints, not nested here, so this one stays fast.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/cliente/me.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../../api/_lib/prisma';
import { signToken } from '../../../api/_lib/auth';
import handler from '../../../api/cliente/me';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/cliente/me', () => {
  let clienteToken: string;
  let clienteId: string;

  beforeAll(async () => {
    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Me Test x12', tipo: 'LIBRE', conZapas: false, cantTickets: 12, precio: 45000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Me Test Cliente', email: 'me-test@realization.com' },
    });
    clienteId = cliente.id;
    clienteToken = signToken({ id: cliente.id, rol: 'CLIENTE' });
    await prisma.compra.create({
      data: {
        clienteId,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 20 * 86400000),
        precioPagado: 45000,
        tickets: {
          create: Array.from({ length: 12 }, (_, i) => ({ estado: i < 8 ? 'CONSUMIDO' : 'DISPONIBLE' } as const)),
        },
      },
    });
    await prisma.reserva.create({
      data: { clienteId, fechaHora: new Date(Date.now() + 2 * 86400000), tipoClase: 'Boulder' },
    });
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Me Test x12' } });
    await prisma.$disconnect();
  });

  it('returns saldo, estado, and the next reserva', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${clienteToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.ticketsDisponibles).toBe(4);
    expect(body.ticketsTotales).toBe(12);
    expect(body.proximaClase).not.toBeNull();
    expect(body.proximaClase.tipoClase).toBe('Boulder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/cliente/me.test.ts`
Expected: FAIL with "Cannot find module '../../../api/cliente/me'"

- [ ] **Step 3: Implement the endpoint**

```typescript
// api/cliente/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, requireRol } from '../_lib/auth';
import { calcularEstadoCuenta } from '../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'CLIENTE', res)) return;

  const cliente = await prisma.cliente.findUnique({
    where: { id: payload.id },
    include: {
      compras: { include: { tickets: true, modalidad: true }, orderBy: { fechaCompra: 'desc' }, take: 1 },
      reservas: { where: { fechaHora: { gte: new Date() } }, orderBy: { fechaHora: 'asc' }, take: 1 },
    },
  });

  if (!cliente) {
    res.status(404).json({ error: 'No encontramos tu cuenta.' });
    return;
  }

  const ultimaCompra = cliente.compras[0] ?? null;
  const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
  const proximaReserva = cliente.reservas[0] ?? null;

  res.status(200).json({
    nombre: cliente.nombre,
    ticketsDisponibles,
    ticketsTotales: ultimaCompra?.tickets.length ?? 0,
    vencimiento: ultimaCompra?.vencimiento ?? null,
    estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
    modalidadNombre: ultimaCompra?.modalidad.nombre ?? null,
    proximaClase: proximaReserva
      ? { fechaHora: proximaReserva.fechaHora, tipoClase: proximaReserva.tipoClase, confirmada: !proximaReserva.aviso24hs }
      : null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/cliente/me.test.ts`
Expected: PASS

- [ ] **Step 5: Implement SaldoCard and ClienteHomePage (manual verification against the mocked API, same pattern as Admin plan Task 9's frontend tests)**

```typescript
// client/src/components/SaldoCard.tsx
export function SaldoCard({
  ticketsDisponibles,
  ticketsTotales,
  modalidadNombre,
  vencimiento,
}: {
  ticketsDisponibles: number;
  ticketsTotales: number;
  modalidadNombre: string | null;
  vencimiento: string | null;
}) {
  const pct = ticketsTotales > 0 ? (ticketsDisponibles / ticketsTotales) * 100 : 0;
  const color = pct > 50 ? 'var(--good)' : pct > 20 ? 'var(--warn)' : 'var(--crit)';

  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-6">
      <p className="font-['Anton'] text-7xl leading-none tabular-nums">{ticketsDisponibles}</p>
      <p className="text-sm text-[var(--rock)] mt-2 mb-4">clases restantes de tu {modalidadNombre ?? 'plan'}</p>
      <div className="h-2 bg-[var(--ink-line)] mb-2">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between font-mono text-xs text-[var(--rock)]">
        <span>{ticketsDisponibles} / {ticketsTotales}</span>
        {vencimiento && <span>Vence {new Date(vencimiento).toLocaleDateString('es-AR')}</span>}
      </div>
    </div>
  );
}
```

```typescript
// client/src/pages/ClienteHomePage.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { SaldoCard } from '../components/SaldoCard';

export function ClienteHomePage() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/cliente/me', {}, token).then(setData);
  }, [token]);

  if (!data) return <p className="p-6">Cargando…</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <p className="text-sm text-[var(--rock)]">Hola, {data.nombre}</p>
      <SaldoCard
        ticketsDisponibles={data.ticketsDisponibles}
        ticketsTotales={data.ticketsTotales}
        modalidadNombre={data.modalidadNombre}
        vencimiento={data.vencimiento}
      />
      {data.proximaClase && (
        <div className="border border-[var(--ink-line)] p-4">
          <p className="text-xs uppercase text-[var(--rock)] mb-1">Próxima clase</p>
          <p>{new Date(data.proximaClase.fechaHora).toLocaleString('es-AR')} — {data.proximaClase.tipoClase}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add api/cliente/me.ts client/src/components/SaldoCard.tsx client/src/pages/ClienteHomePage.tsx tests/
git commit -m "feat: cliente saldo endpoint and home screen saldo card"
```

---

### Task 3: Racha de asistencia

**Files:**
- Create: `api/_lib/racha.ts`, `client/src/components/RachaTag.tsx`
- Modify: `api/cliente/me.ts` (include `rachaSemanas` in the response), `client/src/pages/ClienteHomePage.tsx`
- Test: `tests/api/racha.test.ts`

**Interfaces:**
- Consumes: `CheckIn` model, `prisma`.
- Produces: `api/_lib/racha.ts` exports `calcularRachaSemanas(checkIns: { timestamp: Date }[]): number` — counts consecutive ISO weeks (most recent first) that have at least one check-in, stopping at the first gap.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/racha.test.ts
import { describe, it, expect } from 'vitest';
import { calcularRachaSemanas } from '../../api/_lib/racha';

function haceSemanas(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return { timestamp: d };
}

describe('calcularRachaSemanas', () => {
  it('is 0 with no check-ins', () => {
    expect(calcularRachaSemanas([])).toBe(0);
  });

  it('counts 3 for check-ins this week, last week, and two weeks ago', () => {
    const checkIns = [haceSemanas(0), haceSemanas(1), haceSemanas(2)];
    expect(calcularRachaSemanas(checkIns)).toBe(3);
  });

  it('stops counting at the first gap', () => {
    const checkIns = [haceSemanas(0), haceSemanas(1), haceSemanas(3)];
    expect(calcularRachaSemanas(checkIns)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/racha.test.ts`
Expected: FAIL with "Cannot find module '../../api/_lib/racha'"

- [ ] **Step 3: Implement the racha calculation**

```typescript
// api/_lib/racha.ts
function inicioDeSemanaISO(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function calcularRachaSemanas(checkIns: { timestamp: Date }[]): number {
  if (checkIns.length === 0) return 0;

  const semanasConCheckin = new Set(checkIns.map((c) => inicioDeSemanaISO(c.timestamp).getTime()));
  const semanasOrdenadas = Array.from(semanasConCheckin).sort((a, b) => b - a);

  let racha = 0;
  let cursor = inicioDeSemanaISO(new Date()).getTime();
  const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

  for (const semana of semanasOrdenadas) {
    if (semana === cursor) {
      racha++;
      cursor -= UNA_SEMANA_MS;
    } else if (semana < cursor) {
      break;
    }
  }

  return racha;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/racha.test.ts`
Expected: PASS

- [ ] **Step 5: Wire racha into /api/cliente/me and the home screen**

Modify `api/cliente/me.ts` — add before the `res.status(200).json(...)` call:

```typescript
  const checkIns = await prisma.checkIn.findMany({ where: { clienteId: payload.id }, select: { timestamp: true } });
  const rachaSemanas = calcularRachaSemanas(checkIns);
```

And add `rachaSemanas` to the returned object. Import `calcularRachaSemanas` from `../_lib/racha`.

```typescript
// client/src/components/RachaTag.tsx
export function RachaTag({ semanas }: { semanas: number }) {
  if (semanas < 2) return null;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-[var(--gold-soft)] bg-[rgba(241,180,0,0.1)] border border-[rgba(241,180,0,0.25)] px-3 py-1">
      <span className="w-2 h-2 bg-[var(--gold)]" />
      {semanas} semanas seguidas
    </span>
  );
}
```

Add `<RachaTag semanas={data.rachaSemanas} />` next to the "Hola, {nombre}" line in `ClienteHomePage.tsx`.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/racha.ts api/cliente/me.ts client/src/components/RachaTag.tsx client/src/pages/ClienteHomePage.tsx tests/
git commit -m "feat: racha de asistencia (streak) — solo feature de gamificacion para v1"
```

---

### Task 4: Avisar ausencia (24hs rule, client side)

**Files:**
- Create: `api/cliente/avisar-ausencia.ts`
- Modify: `client/src/pages/ClienteHomePage.tsx` (add the button)
- Test: `tests/api/avisarAusencia.test.ts`

**Interfaces:**
- Consumes: `Reserva` model, `requireAuth`/`requireRol`.
- Produces: `POST /api/cliente/avisar-ausencia` body `{ reservaId }` → sets `reserva.aviso24hs = true`, only if `fechaHora` is more than 24 hours away and the reserva belongs to the calling cliente. Task 6's cron reads `aviso24hs` to decide whether a no-show gets penalized.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/avisarAusencia.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/cliente/avisar-ausencia';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/cliente/avisar-ausencia', () => {
  let clienteToken: string;
  let clienteId: string;
  let reservaLejanaId: string;
  let reservaCercanaId: string;

  beforeAll(async () => {
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Aviso Test', email: 'aviso-test@realization.com' },
    });
    clienteId = cliente.id;
    clienteToken = signToken({ id: cliente.id, rol: 'CLIENTE' });

    const lejana = await prisma.reserva.create({
      data: { clienteId, fechaHora: new Date(Date.now() + 48 * 3600000), tipoClase: 'Boulder' },
    });
    reservaLejanaId = lejana.id;

    const cercana = await prisma.reserva.create({
      data: { clienteId, fechaHora: new Date(Date.now() + 2 * 3600000), tipoClase: 'Boulder' },
    });
    reservaCercanaId = cercana.id;
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.$disconnect();
  });

  it('marks aviso24hs when there is more than 24hs left', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${clienteToken}` }, body: { reservaId: reservaLejanaId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const reserva = await prisma.reserva.findUnique({ where: { id: reservaLejanaId } });
    expect(reserva?.aviso24hs).toBe(true);
  });

  it('rejects with 422 when less than 24hs remain', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${clienteToken}` }, body: { reservaId: reservaCercanaId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(422);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/avisarAusencia.test.ts`
Expected: FAIL with "Cannot find module '../../api/cliente/avisar-ausencia'"

- [ ] **Step 3: Implement the endpoint**

```typescript
// api/cliente/avisar-ausencia.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, requireRol } from '../_lib/auth';

const VEINTICUATRO_HS_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'CLIENTE', res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { reservaId } = req.body as { reservaId: string };
  const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });

  if (!reserva || reserva.clienteId !== payload.id) {
    res.status(404).json({ error: 'No encontramos esa reserva.' });
    return;
  }

  const horasRestantes = reserva.fechaHora.getTime() - Date.now();
  if (horasRestantes < VEINTICUATRO_HS_MS) {
    res.status(422).json({ error: 'Ya pasaron las 24hs previas a la clase, el ticket se descuenta igual.' });
    return;
  }

  await prisma.reserva.update({ where: { id: reservaId }, data: { aviso24hs: true } });
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/avisarAusencia.test.ts`
Expected: PASS

- [ ] **Step 5: Add the button to ClienteHomePage**

Modify `client/src/pages/ClienteHomePage.tsx` — inside the "Próxima clase" block, add:

```typescript
        <button
          onClick={() => apiFetch('/api/cliente/avisar-ausencia', { method: 'POST', body: JSON.stringify({ reservaId: data.proximaClase.id }) }, token).then(() => window.location.reload())}
          className="mt-3 text-xs uppercase text-[var(--rock)] underline"
        >
          Avisar que no voy
        </button>
```

This requires `proximaClase.id` in the `/api/cliente/me` response — add `id: proximaReserva.id` to the `proximaClase` object in `api/cliente/me.ts` from Task 2.

- [ ] **Step 6: Commit**

```bash
git add api/cliente/avisar-ausencia.ts api/cliente/me.ts client/src/pages/ClienteHomePage.tsx tests/
git commit -m "feat: avisar ausencia con 24hs de anticipacion"
```

---

### Task 5: Historial de check-ins

**Files:**
- Create: `api/cliente/historial.ts`, `client/src/components/HistorialItem.tsx`
- Modify: `client/src/pages/ClienteHomePage.tsx`
- Test: `tests/api/historial.test.ts`

**Interfaces:**
- Consumes: `CheckIn` model, `requireAuth`/`requireRol`.
- Produces: `GET /api/cliente/historial` → `{ items: Array<{ id, timestamp, metodo }> }`, last 10, most recent first.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/historial.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/cliente/historial';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/cliente/historial', () => {
  let clienteToken: string;
  let clienteId: string;

  beforeAll(async () => {
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Historial Test', email: 'historial-test@realization.com' },
    });
    clienteId = cliente.id;
    clienteToken = signToken({ id: cliente.id, rol: 'CLIENTE' });
    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL' } });
    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL' } });
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.$disconnect();
  });

  it('returns the check-ins ordered most recent first', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${clienteToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/historial.test.ts`
Expected: FAIL with "Cannot find module '../../api/cliente/historial'"

- [ ] **Step 3: Implement the endpoint**

```typescript
// api/cliente/historial.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';
import { requireAuth, requireRol } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'CLIENTE', res)) return;

  const items = await prisma.checkIn.findMany({
    where: { clienteId: payload.id },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  res.status(200).json({ items: items.map((i) => ({ id: i.id, timestamp: i.timestamp, metodo: i.metodo })) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/historial.test.ts`
Expected: PASS

- [ ] **Step 5: Add HistorialItem and wire it into ClienteHomePage**

```typescript
// client/src/components/HistorialItem.tsx
export function HistorialItem({ timestamp }: { timestamp: string }) {
  return (
    <li className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
      <span>{new Date(timestamp).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
      <span className="font-mono tabular-nums text-[var(--rock)]">–1 ticket</span>
    </li>
  );
}
```

Add a `useEffect` in `ClienteHomePage.tsx` that fetches `/api/cliente/historial` into a `historial` state array, and render `<ul>{historial.map((h) => <HistorialItem key={h.id} timestamp={h.timestamp} />)}</ul>` below the "Próxima clase" block.

- [ ] **Step 6: Commit**

```bash
git add api/cliente/historial.ts client/src/components/HistorialItem.tsx client/src/pages/ClienteHomePage.tsx tests/
git commit -m "feat: historial de check-ins en la home del cliente"
```

---

### Task 6: Cron — penalizar no-shows a las 23:59

**Files:**
- Create: `api/cron/penalizar-no-shows.ts`
- Modify: `vercel.json` (add `crons` entry)
- Test: `tests/api/penalizarNoShows.test.ts`

**Interfaces:**
- Consumes: `Reserva`, `Ticket`, `Activity` models.
- Produces: a Vercel Cron Job hitting this endpoint daily at 23:59 America/Argentina/Buenos_Aires (`02:59` UTC the next day — compute the exact cron UTC offset at deploy time, since UTC-3 has no DST changes so this is fixed) that finds today's reservas with no `CheckIn` and `asistio: false`, marks `asistio: true`, consumes the linked ticket, and logs an `Activity` (`accion: 'penalizacion_no_show'`) for each — skipping any reserva where `aviso24hs` is true.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/penalizarNoShows.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import handler from '../../api/cron/penalizar-no-shows';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('cron penalizar-no-shows', () => {
  let clienteId: string;
  let ticketConAvisoId: string;
  let ticketSinAvisoId: string;

  beforeAll(async () => {
    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Cron Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Cron Test', email: 'cron-test@realization.com' },
    });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: {
        clienteId,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 30 * 86400000),
        precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] },
      },
      include: { tickets: true },
    });
    ticketConAvisoId = compra.tickets[0].id;
    ticketSinAvisoId = compra.tickets[1].id;

    const hoy = new Date();
    hoy.setHours(19, 0, 0, 0);

    await prisma.reserva.create({
      data: { clienteId, ticketId: ticketConAvisoId, fechaHora: hoy, tipoClase: 'Boulder', aviso24hs: true },
    });
    await prisma.reserva.create({
      data: { clienteId, ticketId: ticketSinAvisoId, fechaHora: hoy, tipoClase: 'Boulder', aviso24hs: false },
    });
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { accion: 'penalizacion_no_show' } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Cron Test x4' } });
    await prisma.$disconnect();
  });

  it('penalizes only the reserva without aviso24hs', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const ticketConAviso = await prisma.ticket.findUnique({ where: { id: ticketConAvisoId } });
    expect(ticketConAviso?.estado).toBe('DISPONIBLE');

    const ticketSinAviso = await prisma.ticket.findUnique({ where: { id: ticketSinAvisoId } });
    expect(ticketSinAviso?.estado).toBe('CONSUMIDO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CRON_SECRET=test npx vitest run tests/api/penalizarNoShows.test.ts`
Expected: FAIL with "Cannot find module '../../api/cron/penalizar-no-shows'"

- [ ] **Step 3: Implement the cron handler**

```typescript
// api/cron/penalizar-no-shows.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const hoyInicio = inicioDelDia(new Date());
  const hoyFin = new Date(hoyInicio.getTime() + 86400000);

  const reservasSinAsistencia = await prisma.reserva.findMany({
    where: { fechaHora: { gte: hoyInicio, lt: hoyFin }, asistio: false, aviso24hs: false },
  });

  for (const reserva of reservasSinAsistencia) {
    await prisma.reserva.update({ where: { id: reserva.id }, data: { asistio: true } });

    if (reserva.ticketId) {
      await prisma.ticket.update({
        where: { id: reserva.ticketId },
        data: { estado: 'PENALIZADO', consumidoAt: new Date() },
      });
    }

    await prisma.activity.create({
      data: {
        actorId: 'system',
        actorRol: 'ADMIN',
        accion: 'penalizacion_no_show',
        detalle: { reservaId: reserva.id, clienteId: reserva.clienteId },
      },
    });
  }

  res.status(200).json({ penalizados: reservasSinAsistencia.length });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CRON_SECRET=test npx vitest run tests/api/penalizarNoShows.test.ts`
Expected: PASS

- [ ] **Step 5: Register the Vercel Cron Job**

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/penalizar-no-shows", "schedule": "59 2 * * *" }
  ]
}
```

`59 2 * * *` UTC = 23:59 in UTC-3 (Argentina has no DST, so this offset is fixed year-round). Set `CRON_SECRET` in Vercel env vars (`vercel env add CRON_SECRET production`) — Vercel automatically sends it as the `Authorization: Bearer <CRON_SECRET>` header for cron-triggered requests when configured this way; confirm this against Vercel's current cron-auth docs at deploy time, since this convention has changed across Vercel CLI versions before.

- [ ] **Step 6: Commit**

```bash
git add api/cron/penalizar-no-shows.ts vercel.json tests/
git commit -m "feat: cron nocturno que penaliza no-shows sin aviso de 24hs"
```

---

### Task 7: Deploy the Client app

- [ ] **Step 1: Decide and execute the hosting shape**

At this point, look at how Vercel's monorepo support and the Admin project are actually configured (this plan was written before that decision was locked in). Either:
(a) `vercel link` a new project `realization-client` with Root Directory `client/`, or
(b) add a second `vercel.json` build target in the same project if Vercel added multi-output support for this case by execution time.
Pick (a) unless it's demonstrably worse — it's the simpler, better-understood path today.

- [ ] **Step 2: Set environment variables**

Same `DATABASE_URL` (shared Neon instance) and `JWT_SECRET` (must be the byte-identical secret used by the Admin project, or tokens signed by one won't verify on the other) on the new project.

- [ ] **Step 3: Deploy and smoke-check**

```bash
vercel --prod --yes
```

Visit the resulting URL, call `POST /api/cliente/activar` for the seeded María (`maria@example.com`) with a test password via `curl`, then log in through the UI and confirm the saldo card, racha tag (should be hidden — she has 0 check-ins in the seed data), próxima clase, and historial all render.

- [ ] **Step 4: Commit any config changes from Step 1**

```bash
git add client/vercel.json
git commit -m "chore: deploy client app as its own Vercel project"
git push
```

---

## Self-Review Notes

- **Spec coverage:** saldo siempre visible (Task 2), racha como única gamificación de v1 (Task 3), aviso de ausencia + regla 24hs (Tasks 4 and 6), historial (Task 5), mobile-first una sola pantalla (Global Constraints + `ClienteHomePage` layout), QR/GPS explicitly deferred (Global Constraints).
- **Placeholder scan:** every step has runnable code; Task 7 Step 1 intentionally defers a hosting-shape decision to execution time because it depends on Vercel platform capabilities that may change — this is flagged as a judgment call for the implementer, not a missing spec.
- **Type consistency:** `TokenPayload` and `apiFetch` signatures match the Admin plan exactly (same `_lib/auth.ts`). `calcularEstadoCuenta` return values match the Admin plan's Task 4 definition verbatim (`'activo' | 'por_vencer' | 'vencido'`).

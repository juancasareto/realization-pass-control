# Realization Admin View — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **v2 changelog:** rewritten after a detailed product review. Adds: search/filter on Alumnos, ficha stats (cliente desde, ausencias sin aviso, última visita) + foto, Profesores (label-only, no login yet), Horarios with cupo, a Calendario operativo for días de seteo (cierra el muro) and feriados (aviso, no bloqueo automático), a three-state attendance flow (Presente / Aviso ausencia / sin marcar → recupero automático), and a Cobros screen with one ledger per medio de pago plus retiros. Superseeds the v1 plan of the same name.

**Goal:** Build the Admin app (Dani's tool) for Realization Pass Control — auth, clientes with ficha + cuenta corriente, venta de pases tied to horarios, a full attendance/recovery workflow, planes, cajas, and a data-dense "Hoy" dashboard.

**Architecture:** Monorepo on the existing repo (`realization-pass-control`). A Vite + React 18 + TS admin SPA at the repo root, an Express + TS API under `/api` deployed as Vercel Serverless Functions in the same Vercel project, and a Prisma schema shared by both against Neon Postgres. The Client app (separate plan) will get its own Vite app and, most likely, its own Vercel project later — nothing here blocks that.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, React Router, Express, Prisma v7, Neon Postgres, JWT (`jsonwebtoken`), `bcryptjs`, `@vercel/blob` (foto uploads), Vitest + React Testing Library (frontend), Vitest + Supertest (backend).

## Global Constraints

- **Roles are physically separate apps/pages** — no hiding admin-only UI with CSS. This plan only builds the Admin app.
- **Brand tokens are fixed**: Ink Black `#0B0B0C`, Summit Gold `#F1B400`, Chalk White `#F3F0E8`, Rock Grey `#A49C8A`; state colors (never gold): Good `#4FAE6D`, Warn `#D97B29`, Critical `#E1503D`. Plus one more semantic color introduced by this plan: **Aviso Ausencia = Orange `#E08A3C`** (distinct from Warn, so a low-saldo alert and an "avisó que falta" tag never look the same at a glance). Fonts via Google Fonts: `Anton` (display), `Manrope` (body), `JetBrains Mono` (utility). Reference: `shared/brand/brand-manual.html`.
- **No rounded corners, no illustrated/emoji icons.** Dark theme only.
- **Ticket is a first-class entity**, never a counter.
- **Cuenta corriente is the core system.**
- **Copy rules**: name things by what the user sees; errors explain and give an out, never a raw code.
- **Vercel serverless gotcha**: `await` every side effect before responding.
- **Timezone gotcha**: Neon stores UTC; the business runs in UTC-3 (no DST in Argentina, so the offset is fixed year-round). Every date comparison must be explicit UTC math — never a naive `new Date()` string compare.
- **Recovery window is always 7 calendar days**, measured from the missed class's `fechaHora`, regardless of which of the three attendance paths triggered it.
- **Horarios cupo default is 40** unless the admin changes it per horario.
- **Feriados never auto-block the schedule** — they only raise a banner for the admin to decide. **Días de seteo always close the entire muro** — no reservas, no venta of Clases pases against that date.
- **Feriado data source is still unconfirmed** (pending: ask AsistCheck for their exact API, or default to the public ArgentinaDatos API) — this plan implements manual feriado entry now (a real, working feature) and leaves the automatic sync as a documented fast-follow, not a stub in the code.
- **Caja formal daily close/reconciliation is out of scope** until Dani confirms she needs it — this plan implements the simpler running-ledger-per-medio version.
- **Out of scope for this plan** (explicitly deferred): QR/GPS check-in, Mercado Pago live integration, Profesor login (Profesor is a label only in this plan), reports/analytics beyond Hoy, multi-sucursal, gamification (racha lives in the Client plan).

---

## File Structure

```
realization-pass-control/
├── api/
│   ├── _lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── estadoCuenta.ts
│   │   └── recupero.ts              # shared recovery-window math (Task 10 + cron)
│   ├── auth/
│   │   └── login.ts
│   ├── admin/
│   │   ├── clientes/
│   │   │   ├── index.ts             # GET (list+filter+search), POST (alta)
│   │   │   ├── [id].ts              # GET (ficha completa + stats)
│   │   │   └── [id]/foto.ts         # POST (subir foto)
│   │   ├── modalidades/
│   │   │   └── index.ts
│   │   ├── profesores/
│   │   │   └── index.ts
│   │   ├── horarios/
│   │   │   └── index.ts
│   │   ├── dias-excepcion/
│   │   │   └── index.ts             # GET/POST feriados y días de seteo
│   │   ├── compras/
│   │   │   └── index.ts             # venta de pase (+ genera reservas si es Clases)
│   │   ├── reservas/
│   │   │   ├── index.ts             # GET ?fecha=
│   │   │   ├── [id]/marcar.ts       # POST { estado: PRESENTE | AVISO_AUSENCIA }
│   │   │   └── recuperar.ts         # POST fichar recupero de otro dia
│   │   ├── cobros/
│   │   │   ├── index.ts             # GET saldo+movimientos por caja
│   │   │   └── retiros.ts           # POST registrar retiro
│   │   └── dashboard/
│   │       └── hoy.ts
│   └── health.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── lib/{apiClient.ts,AuthContext.tsx}
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   ├── AdminLayout.tsx
│   │   ├── EstadoBadge.tsx
│   │   ├── AsistenciaBadge.tsx       # Presente/Aviso ausencia/Pendiente colors
│   │   ├── StatTile.tsx
│   │   ├── IngresosSparkline.tsx
│   │   └── FotoUploader.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── ClientesPage.tsx
│       ├── FichaClientePage.tsx
│       ├── ModalidadesPage.tsx
│       ├── HorariosPage.tsx
│       ├── CalendarioPage.tsx
│       ├── VentaPasePage.tsx
│       ├── ReservasPage.tsx
│       ├── CobrosPage.tsx
│       └── DashboardHoyPage.tsx
├── tests/{api/,src/}
├── index.html, vite.config.ts, vitest.config.ts, tailwind.config.ts, package.json, vercel.json
```

This plan lands in 13 tasks, in dependency order: scaffold → schema → auth → clientes → modalidades → profesores/horarios → calendario → venta de pase → ficha → reservas/recupero → cobros → dashboard → deploy.

---

### Task 1: Project scaffold — Vite admin app + Express-on-Vercel API + tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `vercel.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `api/health.ts`
- Test: `tests/api/health.test.ts`, `tests/src/App.test.tsx`

**Interfaces:**
- Produces: `api/health.ts` default handler `(req: VercelRequest, res: VercelResponse) => void`. Every later API task follows this signature.
- Produces: `src/App.tsx` default `App` component mounted at `#root`. Every later page task adds a `<Route>` inside it.

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
npm init -y
npm install react react-dom react-router-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
npm install -D tailwindcss@4 @tailwindcss/postcss postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @vercel/node supertest @types/supertest
```

- [ ] **Step 2: Write the failing test for the health endpoint**

```typescript
// tests/api/health.test.ts
import { describe, it, expect, vi } from 'vitest';
import handler from '../../api/health';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/health', () => {
  it('returns status ok with 200', () => {
    const res = mockRes();
    handler({ method: 'GET' } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/api/health.test.ts`
Expected: FAIL with "Cannot find module '../../api/health'"

- [ ] **Step 4: Implement the health endpoint**

```typescript
// api/health.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: 'ok' });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/health.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing test for the App shell**

```typescript
// tests/src/App.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('App', () => {
  it('renders Realization in the shell', () => {
    render(<App />);
    expect(screen.getByText(/Realization/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/src/App.test.tsx`
Expected: FAIL with "Cannot find module '../../src/App'"

- [ ] **Step 8: Create the Vite/Tailwind/React scaffold files**

```html
<!-- index.html -->
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Realization Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] },
});
```

```typescript
// tests/setup.ts
import '@testing-library/jest-dom/vitest';
```

```css
/* src/index.css */
@import "tailwindcss";

:root {
  --ink: #0b0b0c;
  --ink-raised: #161512;
  --ink-line: #2a2822;
  --gold: #f1b400;
  --gold-soft: #ffd54a;
  --chalk: #f3f0e8;
  --rock: #a49c8a;
  --rock-dim: #6b6456;
  --good: #4fae6d;
  --warn: #d97b29;
  --crit: #e1503d;
  --aviso: #e08a3c;
}

body { background: var(--ink); color: var(--chalk); font-family: 'Manrope', -apple-system, sans-serif; }
```

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

```typescript
// src/App.tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">Realization Admin</h1>
    </div>
  );
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020", "lib": ["ES2020", "DOM"], "module": "ESNext",
    "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true,
    "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true,
    "isolatedModules": true, "noEmit": true
  },
  "include": ["src", "api", "tests", "prisma"]
}
```

```javascript
// postcss.config.js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/$1" }]
}
```

Add to `package.json` `scripts`: `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/src/App.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json tailwind.config.ts postcss.config.js vercel.json index.html src/ api/health.ts tests/ .gitignore
git commit -m "chore: scaffold Vite admin app and Express-on-Vercel API"
```

---

### Task 2: Prisma schema (v2) + Neon connection + seed data

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `api/_lib/prisma.ts`
- Test: `tests/api/seed.test.ts`

**Interfaces:**
- Produces every model and enum used by every later task in this plan. Field names below are used **verbatim** by later tasks — copy them exactly.

- [ ] **Step 1: Install Prisma and set the connection string**

```bash
npm install prisma @prisma/client @vercel/blob bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken tsx
npx prisma init --datasource-provider postgresql
```

Set `DATABASE_URL` in `.env` (Neon pooled connection string) — already `.gitignore`d.

- [ ] **Step 2: Write the full schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMIN
  CLIENTE
}

enum TipoPlan {
  LIBRE
  CLASES
}

enum EstadoTicket {
  DISPONIBLE
  CONSUMIDO
  PENALIZADO
}

enum MedioPago {
  MERCADOPAGO
  TARJETA
  TRANSFERENCIA
  EFECTIVO
}

enum MetodoCheckIn {
  QR
  GPS
  MANUAL
}

// Presente/Aviso ausencia/etc son *estados de la reserva*, no del check-in:
// una reserva puede resolverse sin que exista ningun CheckIn (ej: AVISO_AUSENCIA
// genera una reserva nueva sin necesidad de un checkin en la original).
enum EstadoAsistencia {
  PENDIENTE       // todavia no paso la clase, o paso y nadie la marco
  PRESENTE        // el alumno vino, ticket consumido
  AVISO_AUSENCIA  // aviso antes, no se le consume el ticket, se genera una reserva de recupero
  RECUPERADA      // era una falta pendiente y el alumno vino a otro horario dentro de los 7 dias
  PENALIZADA      // pasaron 7 dias sin aviso ni recupero, se penaliza el ticket
}

enum TipoDiaExcepcion {
  SETEO     // cierra el muro completo: sin reservas, sin venta de Clases para ese dia
  FERIADO   // solo informativo: no bloquea nada, es un aviso para que el admin decida
}

model Admin {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Cliente {
  id           String    @id @default(cuid())
  nombre       String
  email        String    @unique
  telefono     String?
  fotoUrl      String?
  createdAt    DateTime  @default(now())
  compras      Compra[]
  reservas     Reserva[]
  checkIns     CheckIn[]
  pagos        Pago[]
}

model Modalidad {
  id          String   @id @default(cuid())
  nombre      String
  tipo        TipoPlan
  conZapas    Boolean
  cantTickets Int
  precio      Decimal  @db.Decimal(10, 2)
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  compras     Compra[]
}

model Profesor {
  id       String    @id @default(cuid())
  nombre   String
  activo   Boolean   @default(true)
  horarios Horario[]
}

model Horario {
  id          String    @id @default(cuid())
  diaSemana   Int       // ISO: 1=lunes ... 7=domingo
  hora        String    // "19:00"
  tipoClase   String    // ej. "Boulder intermedio"
  cupoMaximo  Int       @default(40)
  profesorId  String?
  profesor    Profesor? @relation(fields: [profesorId], references: [id])
  activo      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  reservas    Reserva[]
}

model DiaExcepcion {
  id               String           @id @default(cuid())
  fecha            DateTime         @unique
  tipo             TipoDiaExcepcion
  nota             String?
  creadoPorSistema Boolean          @default(false)
  createdAt        DateTime         @default(now())
}

model Compra {
  id           String    @id @default(cuid())
  clienteId    String
  cliente      Cliente   @relation(fields: [clienteId], references: [id])
  modalidadId  String
  modalidad    Modalidad @relation(fields: [modalidadId], references: [id])
  fechaCompra  DateTime  @default(now())
  vencimiento  DateTime
  precioPagado Decimal   @db.Decimal(10, 2)
  tickets      Ticket[]
  pago         Pago?
}

model Ticket {
  id          String       @id @default(cuid())
  compraId    String
  compra      Compra       @relation(fields: [compraId], references: [id])
  estado      EstadoTicket @default(DISPONIBLE)
  consumidoAt DateTime?
  reserva     Reserva?
}

model Reserva {
  id               String           @id @default(cuid())
  clienteId        String
  cliente          Cliente          @relation(fields: [clienteId], references: [id])
  ticketId         String?          @unique
  ticket           Ticket?          @relation(fields: [ticketId], references: [id])
  horarioId        String?
  horario          Horario?         @relation(fields: [horarioId], references: [id])
  fechaHora        DateTime
  tipoClase        String
  estadoAsistencia EstadoAsistencia @default(PENDIENTE)
  // Si esta reserva nacio como recupero de otra (aviso ausencia, o recupero
  // de una falta pendiente), recuperaDeId apunta a la reserva original.
  recuperaDeId     String?          @unique
  recuperaDe       Reserva?         @relation("Recupero", fields: [recuperaDeId], references: [id])
  recuperadaPor    Reserva?         @relation("Recupero")
  checkIn          CheckIn?
  createdAt        DateTime         @default(now())
}

model CheckIn {
  id        String        @id @default(cuid())
  clienteId String
  cliente   Cliente       @relation(fields: [clienteId], references: [id])
  reservaId String?       @unique
  reserva   Reserva?      @relation(fields: [reservaId], references: [id])
  timestamp DateTime      @default(now())
  lat       Float?
  lng       Float?
  metodo    MetodoCheckIn
}

model Pago {
  id                String    @id @default(cuid())
  clienteId         String
  cliente           Cliente   @relation(fields: [clienteId], references: [id])
  compraId          String    @unique
  compra            Compra    @relation(fields: [compraId], references: [id])
  monto             Decimal   @db.Decimal(10, 2)
  medio             MedioPago
  descuentoAplicado Decimal   @default(0) @db.Decimal(5, 2)
  mpReferenceId     String?
  createdAt         DateTime  @default(now())
}

model Retiro {
  id        String    @id @default(cuid())
  medio     MedioPago
  monto     Decimal   @db.Decimal(10, 2)
  motivo    String
  actorId   String
  createdAt DateTime  @default(now())
}

model Activity {
  id        String   @id @default(cuid())
  actorId   String
  actorRol  Rol
  accion    String
  detalle   Json?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name init_v2`
Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Create the Prisma client singleton**

```typescript
// api/_lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Write the failing seed test**

```typescript
// tests/api/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { runSeed } from '../../prisma/seed';

describe('seed script', () => {
  beforeAll(async () => { await runSeed(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates admin, modalidades, un profesor, un horario, y un cliente con 12 tickets', async () => {
    const admin = await prisma.admin.findUnique({ where: { email: 'dani@realization.com' } });
    expect(admin).not.toBeNull();

    const profesor = await prisma.profesor.findFirst({ where: { nombre: 'Marcos' } });
    expect(profesor).not.toBeNull();

    const horario = await prisma.horario.findFirst({ where: { profesorId: profesor!.id } });
    expect(horario?.cupoMaximo).toBe(40);

    const cliente = await prisma.cliente.findUnique({
      where: { email: 'maria@example.com' },
      include: { compras: { include: { tickets: true } } },
    });
    expect(cliente!.compras[0].tickets).toHaveLength(12);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/seed.test.ts`
Expected: FAIL with "Cannot find module '../../prisma/seed'"

- [ ] **Step 7: Write the seed script**

```typescript
// prisma/seed.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../api/_lib/prisma';

export async function runSeed() {
  const passwordHash = await bcrypt.hash('realization2026', 10);
  await prisma.admin.upsert({
    where: { email: 'dani@realization.com' },
    update: {},
    create: { nombre: 'Dani', email: 'dani@realization.com', passwordHash },
  });

  const paseX12 = await prisma.modalidad.upsert({
    where: { id: 'seed-pase-x12' }, update: {},
    create: { id: 'seed-pase-x12', nombre: 'Pase x12', tipo: 'LIBRE', conZapas: false, cantTickets: 12, precio: 45000 },
  });
  await prisma.modalidad.upsert({
    where: { id: 'seed-clase-suelta' }, update: {},
    create: { id: 'seed-clase-suelta', nombre: 'Clase suelta', tipo: 'CLASES', conZapas: true, cantTickets: 1, precio: 6000 },
  });
  await prisma.modalidad.upsert({
    where: { id: 'seed-pase-x4' }, update: {},
    create: { id: 'seed-pase-x4', nombre: 'Pase x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000 },
  });

  const profesor = await prisma.profesor.upsert({
    where: { id: 'seed-profesor-marcos' }, update: {},
    create: { id: 'seed-profesor-marcos', nombre: 'Marcos' },
  });

  await prisma.horario.upsert({
    where: { id: 'seed-horario-martes-19' }, update: {},
    create: {
      id: 'seed-horario-martes-19', diaSemana: 2, hora: '19:00',
      tipoClase: 'Boulder intermedio', cupoMaximo: 40, profesorId: profesor.id,
    },
  });

  const cliente = await prisma.cliente.upsert({
    where: { email: 'maria@example.com' }, update: {},
    create: { nombre: 'María González', email: 'maria@example.com', telefono: '1122334455' },
  });

  const vencimiento = new Date();
  vencimiento.setDate(vencimiento.getDate() + 60);

  const compra = await prisma.compra.create({
    data: {
      clienteId: cliente.id, modalidadId: paseX12.id, vencimiento, precioPagado: paseX12.precio,
      tickets: { create: Array.from({ length: 12 }, () => ({ estado: 'DISPONIBLE' as const })) },
    },
  });

  await prisma.pago.create({
    data: { clienteId: cliente.id, compraId: compra.id, monto: paseX12.precio, medio: 'EFECTIVO', descuentoAplicado: 10 },
  });
}

if (require.main === module) {
  runSeed()
    .then(() => prisma.$disconnect())
    .catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/seed.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
npm pkg set scripts.db:seed="tsx prisma/seed.ts"
git add prisma/ api/_lib/prisma.ts tests/api/seed.test.ts package.json package-lock.json
git commit -m "feat: schema v2 (horarios, profesores, dias de excepcion, recupero, cajas) + seed"
```

---

### Task 3: Auth — JWT login + middleware + frontend shell

**Files:**
- Create: `api/_lib/auth.ts`, `api/auth/login.ts`
- Create: `src/lib/apiClient.ts`, `src/lib/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/AdminLayout.tsx`, `src/pages/LoginPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/login.test.ts`, `tests/src/ProtectedRoute.test.tsx`

**Interfaces:**
- Produces: `signToken({id, rol}): string`, `verifyToken(token): {id, rol} | null`, `requireAuth(req, res): payload | null`, `requireRol(payload, rol, res): boolean`. Every `api/admin/**` route in every later task wraps its handler with these two calls, in this exact order, at the top of the function.
- Produces: `useAuth()` returning `{ token, nombre, login(email, password), logout() }`.

- [ ] **Step 1: Write the failing test for login**

```typescript
// tests/api/login.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../../api/_lib/prisma';
import handler from '../../api/auth/login';
import { verifyToken } from '../../api/_lib/auth';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await prisma.admin.upsert({
      where: { email: 'login-test@realization.com' },
      update: { passwordHash },
      create: { nombre: 'Test Admin', email: 'login-test@realization.com', passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.admin.delete({ where: { email: 'login-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const req: any = { method: 'POST', body: { email: 'login-test@realization.com', password: 'secret123' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const token = res.json.mock.calls[0][0].token;
    expect(verifyToken(token)?.rol).toBe('ADMIN');
  });

  it('returns 401 for wrong password', async () => {
    const req: any = { method: 'POST', body: { email: 'login-test@realization.com', password: 'wrong' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/login.test.ts`
Expected: FAIL with "Cannot find module '../../api/auth/login'"

- [ ] **Step 3: Implement auth lib and login route**

```typescript
// api/_lib/auth.ts
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export type TokenPayload = { id: string; rol: 'ADMIN' | 'CLIENTE' };

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '365d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try { return jwt.verify(token, SECRET) as TokenPayload; } catch { return null; }
}

export function requireAuth(req: VercelRequest, res: VercelResponse): TokenPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta el token de autenticación.' });
    return null;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'El token es inválido o expiró.' });
    return null;
  }
  return payload;
}

export function requireRol(payload: TokenPayload, rol: 'ADMIN' | 'CLIENTE', res: VercelResponse): boolean {
  if (payload.rol !== rol) {
    res.status(403).json({ error: 'No tenés permiso para hacer esto.' });
    return false;
  }
  return true;
}
```

```typescript
// api/auth/login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { prisma } from '../_lib/prisma';
import { signToken } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { email, password } = req.body as { email: string; password: string };
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ error: 'Email o contraseña incorrectos.' });
    return;
  }

  const token = signToken({ id: admin.id, rol: 'ADMIN' });
  res.status(200).json({ token, nombre: admin.nombre });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/login.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for ProtectedRoute**

```typescript
// tests/src/ProtectedRoute.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no token', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login screen</div>} />
            <Route path="/admin" element={<ProtectedRoute><div>Secret</div></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/src/ProtectedRoute.test.tsx`
Expected: FAIL with "Cannot find module '../../src/lib/AuthContext'"

- [ ] **Step 7: Implement AuthContext, ProtectedRoute, apiClient, AdminLayout, LoginPage**

```typescript
// src/lib/apiClient.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch(path: string, options: RequestInit = {}, token?: string | null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error de red.' }));
    throw new Error(body.error ?? 'Error de red.');
  }
  return res.json();
}
```

```typescript
// src/lib/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from './apiClient';

type AuthState = { token: string | null; nombre: string | null; login: (e: string, p: string) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rpc_token'));
  const [nombre, setNombre] = useState<string | null>(() => localStorage.getItem('rpc_nombre'));

  async function login(email: string, password: string) {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('rpc_token', data.token);
    localStorage.setItem('rpc_nombre', data.nombre);
    setToken(data.token);
    setNombre(data.nombre);
  }

  function logout() {
    localStorage.removeItem('rpc_token');
    localStorage.removeItem('rpc_nombre');
    setToken(null);
    setNombre(null);
  }

  return <AuthContext.Provider value={{ token, nombre, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
```

```typescript
// src/components/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

```typescript
// src/pages/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try { await login(email, password); navigate('/admin'); }
    catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-[var(--ink-line)] p-8">
        <h1 className="font-['Anton'] uppercase text-3xl mb-6">Realization</h1>
        {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)]" />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)]" />
        <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3">Entrar</button>
      </form>
    </div>
  );
}
```

```typescript
// src/components/AdminLayout.tsx
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const NAV = [
  { to: '/admin', label: 'Hoy', end: true },
  { to: '/admin/clientes', label: 'Alumnos' },
  { to: '/admin/reservas', label: 'Reservas' },
  { to: '/admin/horarios', label: 'Horarios' },
  { to: '/admin/calendario', label: 'Calendario' },
  { to: '/admin/cobros', label: 'Cobros' },
  { to: '/admin/modalidades', label: 'Planes' },
];

export function AdminLayout() {
  const { nombre, logout } = useAuth();
  return (
    <div className="min-h-screen flex">
      <nav className="w-56 border-r border-[var(--ink-line)] p-4 flex flex-col">
        <h1 className="font-['Anton'] uppercase text-xl mb-8">Realization</h1>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `py-2 text-sm uppercase tracking-wide ${isActive ? 'text-[var(--gold)]' : 'text-[var(--rock)]'}`}>
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto text-xs text-[var(--rock-dim)]">
          <p>{nombre}</p>
          <button onClick={logout} className="underline mt-2">Salir</button>
        </div>
      </nav>
      <main className="flex-1 p-8"><Outlet /></main>
    </div>
  );
}
```

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<div>Hoy (Task 12)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

Update `tests/src/App.test.tsx` to assert on `/Realization/i` only (already matches Task 1's version — no change needed).

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/src/ProtectedRoute.test.tsx tests/src/App.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add api/_lib/auth.ts api/auth/ src/ tests/
git commit -m "feat: JWT auth (backend) and login/protected-route shell (frontend)"
```

---

### Task 4: Clientes — listado con búsqueda, filtro por estado, y alta

**Files:**
- Create: `api/_lib/estadoCuenta.ts`, `api/admin/clientes/index.ts`
- Create: `src/components/EstadoBadge.tsx`, `src/pages/ClientesPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/estadoCuenta.test.ts`, `tests/api/clientes.test.ts`, `tests/src/ClientesPage.test.tsx`

**Interfaces:**
- Produces: `calcularEstadoCuenta(ticketsDisponibles, vencimiento): 'activo' | 'por_vencer' | 'vencido'` — Task 9 (Ficha) and Task 12 (Dashboard) call this, same three values, nothing else.
- Produces: `GET /api/admin/clientes?q=&estado=` → `{ clientes: [{ id, nombre, email, ticketsDisponibles, vencimiento, estado }] }`. `q` filters by nombre/email substring (case-insensitive), `estado` filters by the computed estado. Both optional and combinable.

- [ ] **Step 1: Write the failing test for estado de cuenta**

```typescript
// tests/api/estadoCuenta.test.ts
import { describe, it, expect } from 'vitest';
import { calcularEstadoCuenta } from '../../api/_lib/estadoCuenta';

describe('calcularEstadoCuenta', () => {
  it('is "vencido" when there are no tickets disponibles', () => {
    expect(calcularEstadoCuenta(0, new Date(Date.now() + 30 * 86400000))).toBe('vencido');
  });
  it('is "vencido" when vencimiento already passed', () => {
    expect(calcularEstadoCuenta(5, new Date(Date.now() - 86400000))).toBe('vencido');
  });
  it('is "por_vencer" when <=2 tickets remain or vencimiento is within 7 days', () => {
    expect(calcularEstadoCuenta(2, new Date(Date.now() + 30 * 86400000))).toBe('por_vencer');
    expect(calcularEstadoCuenta(8, new Date(Date.now() + 5 * 86400000))).toBe('por_vencer');
  });
  it('is "activo" otherwise', () => {
    expect(calcularEstadoCuenta(8, new Date(Date.now() + 30 * 86400000))).toBe('activo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/estadoCuenta.test.ts`
Expected: FAIL with "Cannot find module '../../api/_lib/estadoCuenta'"

- [ ] **Step 3: Implement estado de cuenta**

```typescript
// api/_lib/estadoCuenta.ts
export type EstadoCuenta = 'activo' | 'por_vencer' | 'vencido';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const UMBRAL_TICKETS_BAJOS = 2;

export function calcularEstadoCuenta(ticketsDisponibles: number, vencimiento: Date | null): EstadoCuenta {
  if (ticketsDisponibles <= 0) return 'vencido';
  if (!vencimiento) return 'activo';
  if (vencimiento.getTime() < Date.now()) return 'vencido';
  if (ticketsDisponibles <= UMBRAL_TICKETS_BAJOS || vencimiento.getTime() - Date.now() <= SIETE_DIAS_MS) return 'por_vencer';
  return 'activo';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/estadoCuenta.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the clientes list endpoint (with search + filter)**

```typescript
// tests/api/clientes.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/clientes/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/clientes', () => {
  let adminToken: string;
  let clienteActivoId: string;
  let clienteVencidoId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'clientes-test-admin@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 10000 } });

    const activo = await prisma.cliente.create({ data: { nombre: 'Julieta Activa', email: 'julieta-activa@realization.com' } });
    clienteActivoId = activo.id;
    await prisma.compra.create({
      data: { clienteId: activo.id, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 10000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] } },
    });

    const vencido = await prisma.cliente.create({ data: { nombre: 'Nico Vencido', email: 'nico-vencido@realization.com' } });
    clienteVencidoId = vencido.id;
    await prisma.compra.create({
      data: { clienteId: vencido.id, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 10000,
        tickets: { create: [{ estado: 'CONSUMIDO' }, { estado: 'CONSUMIDO' }] } },
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { compra: { clienteId: { in: [clienteActivoId, clienteVencidoId] } } } });
    await prisma.compra.deleteMany({ where: { clienteId: { in: [clienteActivoId, clienteVencidoId] } } });
    await prisma.cliente.deleteMany({ where: { id: { in: [clienteActivoId, clienteVencidoId] } } });
    await prisma.admin.delete({ where: { email: 'clientes-test-admin@realization.com' } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Test x4' } });
    await prisma.$disconnect();
  });

  it('rejects without auth', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('filters by search text (q)', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { q: 'Julieta' } } as any, res);
    const body = res.json.mock.calls[0][0];
    expect(body.clientes).toHaveLength(1);
    expect(body.clientes[0].nombre).toBe('Julieta Activa');
  });

  it('filters by estado', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { estado: 'vencido' } } as any, res);
    const body = res.json.mock.calls[0][0];
    expect(body.clientes.some((c: any) => c.id === clienteVencidoId)).toBe(true);
    expect(body.clientes.some((c: any) => c.id === clienteActivoId)).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/clientes.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/clientes/index'"

- [ ] **Step 7: Implement the clientes list + alta endpoint**

```typescript
// api/admin/clientes/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { calcularEstadoCuenta, type EstadoCuenta } from '../../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const { q, estado } = req.query as { q?: string; estado?: EstadoCuenta };

    const clientes = await prisma.cliente.findMany({
      where: q ? { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : undefined,
      include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } },
      orderBy: { nombre: 'asc' },
    });

    let result = clientes.map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
      return {
        id: c.id, nombre: c.nombre, email: c.email, ticketsDisponibles,
        vencimiento: ultimaCompra?.vencimiento ?? null,
        estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
      };
    });

    if (estado) result = result.filter((c) => c.estado === estado);

    res.status(200).json({ clientes: result });
    return;
  }

  if (req.method === 'POST') {
    const { nombre, email, telefono } = req.body as { nombre: string; email: string; telefono?: string };
    const cliente = await prisma.cliente.create({ data: { nombre, email, telefono } });
    res.status(201).json({ cliente });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/clientes.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for ClientesPage (search box + estado dropdown)**

```typescript
// tests/src/ClientesPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ClientesPage } from '../../src/pages/ClientesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ClientesPage', () => {
  it('renders rows with estado badges and re-fetches when the search box changes', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      clientes: [{ id: '1', nombre: 'María', email: 'm@x.com', ticketsDisponibles: 8, vencimiento: null, estado: 'activo' }],
    });

    // ClientesPage calls useAuth() (needs AuthProvider) and renders <Link> (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter><ClientesPage /></MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('María')).toBeInTheDocument());
    expect(screen.getByText('Activo')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email'), { target: { value: 'mar' } });
    // AuthProvider's initial token is null (no rpc_token in jsdom's localStorage), not undefined.
    await waitFor(() => expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('q=mar'), {}, null));
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/src/ClientesPage.test.tsx`
Expected: FAIL with "Cannot find module '../../src/pages/ClientesPage'"

- [ ] **Step 11: Implement EstadoBadge and ClientesPage**

```typescript
// src/components/EstadoBadge.tsx
const LABELS: Record<string, string> = { activo: 'Activo', por_vencer: 'Por vencer', vencido: 'Vencido' };
const COLORS: Record<string, string> = {
  activo: 'bg-[#173322] text-[var(--good)]',
  por_vencer: 'bg-[#3a2712] text-[var(--warn)]',
  vencido: 'bg-[#3a1a15] text-[var(--crit)]',
};

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`font-mono text-xs uppercase px-2 py-1 ${COLORS[estado]}`}>{LABELS[estado]}</span>;
}
```

```typescript
// src/pages/ClientesPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';

type ClienteRow = { id: string; nombre: string; email: string; ticketsDisponibles: number; estado: string };

export function ClientesPage() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    apiFetch(`/api/admin/clientes?${params.toString()}`, {}, token).then((data) => setClientes(data.clientes));
  }, [q, estado, token]);

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Alumnos</h2>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Buscar por nombre o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="por_vencer">Por vencer</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Nombre</th><th className="text-left py-2">Tickets</th><th className="text-left py-2">Estado</th></tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3"><Link to={`/admin/clientes/${c.id}`} className="hover:text-[var(--gold)]">{c.nombre}</Link></td>
              <td className="py-3 font-mono tabular-nums">{c.ticketsDisponibles}</td>
              <td className="py-3"><EstadoBadge estado={c.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Add the route to `src/App.tsx`: `<Route path="clientes" element={<ClientesPage />} />` inside `/admin`.

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/src/ClientesPage.test.tsx`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add api/_lib/estadoCuenta.ts api/admin/clientes/ src/components/EstadoBadge.tsx src/pages/ClientesPage.tsx src/App.tsx tests/
git commit -m "feat: clientes list with search, estado filter, and computed estado de cuenta"
```

---

### Task 5: Modalidades (Planes) — CRUD

**Files:**
- Create: `api/admin/modalidades/index.ts`, `src/pages/ModalidadesPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/modalidades.test.ts`, `tests/src/ModalidadesPage.test.tsx`

**Interfaces:**
- Produces: `GET /api/admin/modalidades` → `{ modalidades: [{ id, nombre, tipo, conZapas, cantTickets, precio, activo }] }`; `POST` creates one; `PATCH ?id=` updates. Task 8 (Venta de pase) reads this list; Task 6 (Horarios) does not depend on it (a Horario is independent of Modalidad — many Clases modalidades can point at the same Horario).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/modalidades.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/modalidades/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/modalidades', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'modalidades-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.modalidad.deleteMany({ where: { nombre: 'Pase x6' } });
    await prisma.admin.delete({ where: { email: 'modalidades-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a new modalidad and lists it', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { nombre: 'Pase x6', tipo: 'LIBRE', conZapas: false, cantTickets: 6, precio: 24000 } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    const body = listRes.json.mock.calls[0][0];
    expect(body.modalidades.some((m: any) => m.nombre === 'Pase x6')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/modalidades.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/modalidades/index'"

- [ ] **Step 3: Implement the endpoint**

```typescript
// api/admin/modalidades/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const modalidades = await prisma.modalidad.findMany({ orderBy: { precio: 'asc' } });
    res.status(200).json({ modalidades });
    return;
  }

  if (req.method === 'POST') {
    const { nombre, tipo, conZapas, cantTickets, precio } = req.body;
    const modalidad = await prisma.modalidad.create({ data: { nombre, tipo, conZapas, cantTickets, precio } });
    res.status(201).json({ modalidad });
    return;
  }

  if (req.method === 'PATCH') {
    const { id } = req.query as { id: string };
    const modalidad = await prisma.modalidad.update({ where: { id }, data: req.body });
    res.status(200).json({ modalidad });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/modalidades.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for ModalidadesPage**

```typescript
// tests/src/ModalidadesPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ModalidadesPage } from '../../src/pages/ModalidadesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ModalidadesPage', () => {
  it('toggles activo when the switch is clicked', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation((path) => {
      if (path === '/api/admin/modalidades') {
        return Promise.resolve({ modalidades: [{ id: '1', nombre: 'Pase x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000, activo: true }] });
      }
      return Promise.resolve({ modalidad: {} });
    });

    // ModalidadesPage calls useAuth() — needs AuthProvider or the render throws.
    render(<AuthProvider><ModalidadesPage /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Pase x4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox'));
    // AuthProvider's initial token is null (no rpc_token in jsdom's localStorage), not undefined.
    await waitFor(() =>
      expect(apiClient.apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/modalidades?id=1'), expect.objectContaining({ method: 'PATCH' }), null)
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/src/ModalidadesPage.test.tsx`
Expected: FAIL with "Cannot find module '../../src/pages/ModalidadesPage'"

- [ ] **Step 7: Implement ModalidadesPage**

```typescript
// src/pages/ModalidadesPage.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

type Modalidad = { id: string; nombre: string; tipo: string; conZapas: boolean; cantTickets: number; precio: number; activo: boolean };

export function ModalidadesPage() {
  const { token } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);

  useEffect(() => { apiFetch('/api/admin/modalidades', {}, token).then((data) => setModalidades(data.modalidades)); }, [token]);

  async function toggleActivo(m: Modalidad) {
    await apiFetch(`/api/admin/modalidades?id=${m.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !m.activo }) }, token);
    setModalidades((prev) => prev.map((x) => (x.id === m.id ? { ...x, activo: !x.activo } : x)));
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Planes</h2>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Nombre</th><th className="text-left py-2">Tipo</th><th className="text-left py-2">Zapas</th><th className="text-left py-2">Tickets</th><th className="text-left py-2">Precio</th><th className="text-left py-2">Activo</th></tr>
        </thead>
        <tbody>
          {modalidades.map((m) => (
            <tr key={m.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">{m.nombre}</td>
              <td className="py-3">{m.tipo}</td>
              <td className="py-3">{m.conZapas ? 'Con zapas' : 'Sin zapas'}</td>
              <td className="py-3 font-mono tabular-nums">{m.cantTickets}</td>
              <td className="py-3 font-mono tabular-nums">${m.precio}</td>
              <td className="py-3"><input type="checkbox" checked={m.activo} onChange={() => toggleActivo(m)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Add the route: `<Route path="modalidades" element={<ModalidadesPage />} />`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/src/ModalidadesPage.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add api/admin/modalidades/ src/pages/ModalidadesPage.tsx src/App.tsx tests/
git commit -m "feat: modalidades CRUD (planes admin)"
```

---

### Task 6: Profesores + Horarios — CRUD (el profesor es una etiqueta, sin login)

**Files:**
- Create: `api/admin/profesores/index.ts`, `api/admin/horarios/index.ts`, `src/pages/HorariosPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/profesores.test.ts`, `tests/api/horarios.test.ts`, `tests/src/HorariosPage.test.tsx`

**Interfaces:**
- Produces: `GET/POST /api/admin/profesores` → `{ profesores: [{ id, nombre, activo }] }`. Task 6's own `HorariosPage` reads this to populate a `<select>`; no other task depends on it.
- Produces: `GET/POST/PATCH /api/admin/horarios` → `{ horarios: [{ id, diaSemana, hora, tipoClase, cupoMaximo, profesorId, profesorNombre, activo }] }`. Task 8 (Venta de pase) and Task 10 (Reservas) both read this list by `id` — that field name doesn't change downstream.

- [ ] **Step 1: Write the failing test for profesores**

```typescript
// tests/api/profesores.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/profesores/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/profesores', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'profesores-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.profesor.deleteMany({ where: { nombre: 'Sofía' } });
    await prisma.admin.delete({ where: { email: 'profesores-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates and lists a profesor', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { nombre: 'Sofía' } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    expect(listRes.json.mock.calls[0][0].profesores.some((p: any) => p.nombre === 'Sofía')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/profesores.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/profesores/index'"

- [ ] **Step 3: Implement profesores endpoint**

```typescript
// api/admin/profesores/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

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
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/profesores.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for horarios**

```typescript
// tests/api/horarios.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/horarios/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/horarios', () => {
  let adminToken: string;
  let profesorId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'horarios-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const profesor = await prisma.profesor.create({ data: { nombre: 'Horarios Test Profe' } });
    profesorId = profesor.id;
  });

  afterAll(async () => {
    await prisma.horario.deleteMany({ where: { profesorId } });
    await prisma.profesor.delete({ where: { id: profesorId } });
    await prisma.admin.delete({ where: { email: 'horarios-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a horario with the default cupo of 40 and lists it with the profesor name resolved', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { diaSemana: 4, hora: '20:00', tipoClase: 'Boulder avanzado', profesorId } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json.mock.calls[0][0].horario.cupoMaximo).toBe(40);

    const listRes = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, listRes);
    const found = listRes.json.mock.calls[0][0].horarios.find((h: any) => h.tipoClase === 'Boulder avanzado');
    expect(found.profesorNombre).toBe('Horarios Test Profe');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/horarios.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/horarios/index'"

- [ ] **Step 7: Implement horarios endpoint**

```typescript
// api/admin/horarios/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/horarios.test.ts`
Expected: PASS

- [ ] **Step 9: Implement HorariosPage (manual verification — table + create form, same interaction pattern already covered by ModalidadesPage's test)**

```typescript
// src/pages/HorariosPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function HorariosPage() {
  const { token } = useAuth();
  const [horarios, setHorarios] = useState<any[]>([]);
  const [profesores, setProfesores] = useState<any[]>([]);
  const [diaSemana, setDiaSemana] = useState(2);
  const [hora, setHora] = useState('19:00');
  const [tipoClase, setTipoClase] = useState('');
  const [profesorId, setProfesorId] = useState('');

  async function cargar() {
    const [h, p] = await Promise.all([
      apiFetch('/api/admin/horarios', {}, token),
      apiFetch('/api/admin/profesores', {}, token),
    ]);
    setHorarios(h.horarios);
    setProfesores(p.profesores);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/horarios', { method: 'POST', body: JSON.stringify({ diaSemana, hora, tipoClase, profesorId: profesorId || undefined }) }, token);
    setTipoClase('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Horarios</h2>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6 flex-wrap">
        <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          {DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </select>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <input placeholder="Tipo de clase" value={tipoClase} onChange={(e) => setTipoClase(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <select value={profesorId} onChange={(e) => setProfesorId(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          <option value="">Sin profesor asignado</option>
          {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button type="submit" className="bg-[var(--gold)] text-[var(--ink)] font-bold px-4 py-2 text-sm">Agregar horario</button>
      </form>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr><th className="text-left py-2">Día</th><th className="text-left py-2">Hora</th><th className="text-left py-2">Clase</th><th className="text-left py-2">Profe</th><th className="text-left py-2">Cupo</th></tr>
        </thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">{DIAS[h.diaSemana]}</td>
              <td className="py-3 font-mono tabular-nums">{h.hora}</td>
              <td className="py-3">{h.tipoClase}</td>
              <td className="py-3">{h.profesorNombre ?? '—'}</td>
              <td className="py-3 font-mono tabular-nums">{h.cupoMaximo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Add the route: `<Route path="horarios" element={<HorariosPage />} />`.

- [ ] **Step 10: Commit**

```bash
git add api/admin/profesores/ api/admin/horarios/ src/pages/HorariosPage.tsx src/App.tsx tests/
git commit -m "feat: profesores (etiqueta, sin login) y horarios con cupo"
```

---

### Task 7: Calendario operativo — días de seteo (cierran todo) y feriados (aviso)

**Files:**
- Create: `api/admin/dias-excepcion/index.ts`, `src/pages/CalendarioPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/diasExcepcion.test.ts`

**Interfaces:**
- Produces: `esDiaDeSeteo(fecha: Date): Promise<boolean>` — exported from `api/admin/dias-excepcion/index.ts` for reuse (Task 8's venta de pase calls this before generating reservas). `GET /api/admin/dias-excepcion?desde=&hasta=` → `{ dias: [{ id, fecha, tipo, nota }] }`; `POST` creates one (manual entry — this is the real v1 feature; automatic sync against a feriados API is a documented fast-follow once the provider is confirmed, not built here).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/diasExcepcion.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler, { esDiaDeSeteo } from '../../api/admin/dias-excepcion/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('/api/admin/dias-excepcion', () => {
  let adminToken: string;
  const fechaSeteo = new Date('2026-09-15T00:00:00.000Z');

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'dias-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.diaExcepcion.deleteMany({ where: { fecha: fechaSeteo } });
    await prisma.admin.delete({ where: { email: 'dias-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a día de seteo and esDiaDeSeteo confirms it', async () => {
    const createRes = mockRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { fecha: fechaSeteo.toISOString(), tipo: 'SETEO', nota: 'Cambio de vías del sector boulder' } } as any, createRes);
    expect(createRes.status).toHaveBeenCalledWith(201);

    expect(await esDiaDeSeteo(fechaSeteo)).toBe(true);
    expect(await esDiaDeSeteo(new Date('2026-09-16T00:00:00.000Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/diasExcepcion.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/dias-excepcion/index'"

- [ ] **Step 3: Implement the endpoint and the shared helper**

```typescript
// api/admin/dias-excepcion/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function esDiaDeSeteo(fecha: Date): Promise<boolean> {
  const dia = await prisma.diaExcepcion.findUnique({ where: { fecha: inicioDelDia(fecha) } });
  return dia?.tipo === 'SETEO';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };
    const dias = await prisma.diaExcepcion.findMany({
      where: desde && hasta ? { fecha: { gte: new Date(desde), lte: new Date(hasta) } } : undefined,
      orderBy: { fecha: 'asc' },
    });
    res.status(200).json({ dias });
    return;
  }

  if (req.method === 'POST') {
    const { fecha, tipo, nota } = req.body as { fecha: string; tipo: 'SETEO' | 'FERIADO'; nota?: string };
    const dia = await prisma.diaExcepcion.create({ data: { fecha: inicioDelDia(new Date(fecha)), tipo, nota } });
    res.status(201).json({ dia });
    return;
  }

  res.status(405).json({ error: 'Método no permitido.' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/diasExcepcion.test.ts`
Expected: PASS

- [ ] **Step 5: Implement CalendarioPage (manual verification — a simple form plus list, same pattern as HorariosPage)**

```typescript
// src/pages/CalendarioPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

export function CalendarioPage() {
  const { token } = useAuth();
  const [dias, setDias] = useState<any[]>([]);
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<'SETEO' | 'FERIADO'>('SETEO');
  const [nota, setNota] = useState('');

  async function cargar() {
    const data = await apiFetch('/api/admin/dias-excepcion', {}, token);
    setDias(data.dias);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/dias-excepcion', { method: 'POST', body: JSON.stringify({ fecha, tipo, nota }) }, token);
    setFecha('');
    setNota('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-2">Calendario</h2>
      <p className="text-sm text-[var(--rock)] mb-6">
        Un día de <strong>seteo</strong> cierra el muro completo (no hay clases ni escalada libre). Un <strong>feriado</strong> es solo un aviso —
        no cancela nada solo, decidís vos si tocás el horario ese día.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'SETEO' | 'FERIADO')} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          <option value="SETEO">Día de seteo (cierra todo)</option>
          <option value="FERIADO">Feriado (aviso)</option>
        </select>
        <input placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <button type="submit" className="bg-[var(--gold)] text-[var(--ink)] font-bold px-4 py-2 text-sm">Agregar</button>
      </form>
      <ul>
        {dias.map((d) => (
          <li key={d.id} className="flex justify-between border-t border-[var(--ink-line)] py-3 text-sm">
            <span>{new Date(d.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })} — {d.nota ?? 'Sin nota'}</span>
            <span className={`font-mono text-xs uppercase ${d.tipo === 'SETEO' ? 'text-[var(--crit)]' : 'text-[var(--aviso)]'}`}>{d.tipo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Add the route: `<Route path="calendario" element={<CalendarioPage />} />`.

- [ ] **Step 6: Commit**

```bash
git add api/admin/dias-excepcion/ src/pages/CalendarioPage.tsx src/App.tsx tests/
git commit -m "feat: calendario operativo — dias de seteo (cierran el muro) y feriados (aviso)"
```

---

### Task 8: Venta de pase — Compra + Tickets + Pago, y si es "Clases", genera las reservas del horario

**Files:**
- Create: `api/admin/compras/index.ts`, `src/pages/VentaPasePage.tsx`
- Modify: `src/App.tsx`, `src/pages/ClientesPage.tsx` (link a "Vender pase")
- Test: `tests/api/compras.test.ts`

**Interfaces:**
- Consumes: `Modalidad` (Task 5), `Horario` (Task 6), `esDiaDeSeteo` (Task 7).
- Produces: `POST /api/admin/compras` body `{ clienteId, modalidadId, medio, descuentoAplicado?, horarioId? }`. `horarioId` is **required when the modalidad's `tipo` is `CLASES`** and ignored for `LIBRE`. Creates one `Compra` + `cantTickets` `Ticket` rows + one `Pago`; for `CLASES`, also creates one `Reserva` per ticket at the horario's weekly cadence (skipping días de seteo), each `Reserva.estadoAsistencia` starting at `PENDIENTE`. Also produces and **exports** `siguienteFechaHabil(diaSemanaISO, hora, desde): Promise<Date>` — Task 10 imports this same function from `../compras/index` to compute the makeup-class date for an "Aviso ausencia", so the two places that schedule a class one week out never drift apart. Task 9 (Ficha) and Task 10 (Reservas) both read the resulting `Reserva` rows.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/compras.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/compras/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

import { vi } from 'vitest';

describe('POST /api/admin/compras', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let modalidadLibreId: string;
  let modalidadClasesId: string;
  let horarioId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'compras-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const cliente = await prisma.cliente.create({ data: { nombre: 'Compra Test', email: 'compras-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const modalidadLibre = await prisma.modalidad.create({ data: { nombre: 'Compra Test Libre x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    modalidadLibreId = modalidadLibre.id;

    const modalidadClases = await prisma.modalidad.create({ data: { nombre: 'Compra Test Clases x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 20000 } });
    modalidadClasesId = modalidadClases.id;

    const horario = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    horarioId = horario.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { id: { in: [modalidadLibreId, modalidadClasesId] } } });
    await prisma.horario.delete({ where: { id: horarioId } });
    await prisma.admin.delete({ where: { email: 'compras-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: 'venta_pase' } });
    await prisma.$disconnect();
  });

  it('LIBRE: creates tickets and a pago, no reservas', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadLibreId, medio: 'EFECTIVO', descuentoAplicado: 10 } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const compra = res.json.mock.calls[0][0].compra;

    const tickets = await prisma.ticket.findMany({ where: { compraId: compra.id } });
    expect(tickets).toHaveLength(4);

    const reservas = await prisma.reserva.findMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } });
    expect(reservas).toHaveLength(0);
  });

  it('CLASES: requires horarioId and generates one reserva per ticket a una semana de distancia', async () => {
    const sinHorario: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadClasesId, medio: 'EFECTIVO' } };
    const resSinHorario = mockRes();
    await handler(sinHorario, resSinHorario);
    expect(resSinHorario.status).toHaveBeenCalledWith(422);

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId: modalidadClasesId, medio: 'TRANSFERENCIA', horarioId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const compra = res.json.mock.calls[0][0].compra;

    const reservas = await prisma.reserva.findMany({ where: { horarioId, ticket: { compraId: compra.id } }, orderBy: { fechaHora: 'asc' } });
    expect(reservas).toHaveLength(4);
    for (let i = 1; i < reservas.length; i++) {
      const diffDias = (reservas[i].fechaHora.getTime() - reservas[i - 1].fechaHora.getTime()) / 86400000;
      expect(diffDias).toBe(7);
    }
    expect(reservas.every((r) => r.estadoAsistencia === 'PENDIENTE')).toBe(true);

    const activity = await prisma.activity.findFirst({ where: { accion: 'venta_pase', actorId: adminId } });
    expect(activity).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/compras.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/compras/index'"

- [ ] **Step 3: Implement the venta de pase endpoint**

```typescript
// api/admin/compras/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/compras.test.ts`
Expected: PASS

- [ ] **Step 5: Implement VentaPasePage (shows the horario selector only for Clases modalidades)**

```typescript
// src/pages/VentaPasePage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function VentaPasePage() {
  const { clienteId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [modalidadId, setModalidadId] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [medio, setMedio] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch('/api/admin/modalidades', {}, token), apiFetch('/api/admin/horarios', {}, token)]).then(([m, h]) => {
      setModalidades(m.modalidades.filter((x: any) => x.activo));
      setHorarios(h.horarios.filter((x: any) => x.activo));
    });
  }, [token]);

  const modalidadElegida = modalidades.find((m) => m.id === modalidadId);
  const esClases = modalidadElegida?.tipo === 'CLASES';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/admin/compras', {
        method: 'POST',
        body: JSON.stringify({ clienteId, modalidadId, medio, descuentoAplicado: descuento, horarioId: esClases ? horarioId : undefined }),
      }, token);
      navigate(`/admin/clientes/${clienteId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Vender pase</h2>
      {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
      <select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)} required className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2">
        <option value="">Elegí un plan</option>
        {modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre} — ${m.precio}</option>)}
      </select>
      {esClases && (
        <select value={horarioId} onChange={(e) => setHorarioId(e.target.value)} required className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2">
          <option value="">Elegí el horario fijo</option>
          {horarios.map((h) => <option key={h.id} value={h.id}>{DIAS[h.diaSemana]} {h.hora} — {h.tipoClase}</option>)}
        </select>
      )}
      <select value={medio} onChange={(e) => setMedio(e.target.value)} className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2">
        <option value="EFECTIVO">Efectivo</option>
        <option value="TRANSFERENCIA">Transferencia</option>
        <option value="TARJETA">Tarjeta</option>
        <option value="MERCADOPAGO">Mercado Pago</option>
      </select>
      <input type="number" placeholder="Descuento %" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))}
        className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2" />
      <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3">Registrar venta</button>
    </form>
  );
}
```

Add the route: `<Route path="clientes/:clienteId/vender" element={<VentaPasePage />} />`. Add a "Vender pase" link per row in `ClientesPage.tsx` pointing to `/admin/clientes/${c.id}/vender`.

- [ ] **Step 6: Commit**

```bash
git add api/admin/compras/ src/pages/VentaPasePage.tsx src/App.tsx src/pages/ClientesPage.tsx tests/
git commit -m "feat: venta de pase — genera reservas automaticas para planes de Clases"
```

---

### Task 9: Ficha de Cliente — estadísticas, foto, e historial completo (compras, pagos, reservas)

**Files:**
- Create: `api/admin/clientes/[id].ts`, `api/admin/clientes/[id]/foto.ts`
- Create: `src/components/FotoUploader.tsx`, `src/pages/FichaClientePage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/fichaCliente.test.ts`, `tests/api/fotoCliente.test.ts`, `tests/src/FichaClientePage.test.tsx`

**Interfaces:**
- Produces: `GET /api/admin/clientes/:id` → `{ cliente: { id, nombre, email, telefono, fotoUrl, estado, ticketsDisponibles, vencimiento, clienteDesde, ausenciasSinAviso, ultimaVisita }, compras, pagos, reservas }`, where `reservas` items include `estadoAsistencia`. Produces: `POST /api/admin/clientes/:id/foto` body `{ fotoBase64 }` (a data URL) → `{ fotoUrl }`.

- [ ] **Step 1: Write the failing test for the ficha endpoint (stats)**

```typescript
// tests/api/fichaCliente.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/clientes/[id]';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/clientes/:id', () => {
  let adminToken: string;
  let clienteId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'ficha-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Ficha Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Ficha Test Cliente', email: 'ficha-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }, { estado: 'CONSUMIDO' }, { estado: 'PENALIZADO' }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
      include: { tickets: true },
    });

    // una reserva penalizada (cuenta como "ausencia sin aviso") y un check-in reciente
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[3].id, fechaHora: new Date(Date.now() - 10 * 86400000), tipoClase: 'Boulder', estadoAsistencia: 'PENALIZADA' } });
    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL', timestamp: new Date(Date.now() - 2 * 86400000) } });
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Ficha Test x4' } });
    await prisma.admin.delete({ where: { email: 'ficha-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('returns cliente stats, estado, compras, pagos, and reservas con estadoAsistencia', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.cliente.ticketsDisponibles).toBe(2);
    expect(body.cliente.estado).toBe('por_vencer');
    expect(body.cliente.ausenciasSinAviso).toBe(1);
    expect(body.cliente.ultimaVisita).not.toBeNull();
    expect(body.cliente.clienteDesde).not.toBeNull();
    expect(body.reservas.some((r: any) => r.estadoAsistencia === 'PENALIZADA')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/fichaCliente.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/clientes/[id]'"

- [ ] **Step 3: Implement the ficha endpoint**

```typescript
// api/admin/clientes/[id].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };

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
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/fichaCliente.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for foto upload (mocking @vercel/blob)**

```typescript
// tests/api/fotoCliente.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example.com/clientes/fake.jpg' }),
}));

import handler from '../../api/admin/clientes/[id]/foto';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/clientes/:id/foto', () => {
  let adminToken: string;
  let clienteId: string;
  const PIXEL_1X1_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'foto-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Foto Test', email: 'foto-test-cliente@realization.com' } });
    clienteId = cliente.id;
  });

  afterAll(async () => {
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'foto-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('uploads the photo and saves the URL on the cliente', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId },
      body: { fotoBase64: `data:image/jpeg;base64,${PIXEL_1X1_JPEG_BASE64}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].fotoUrl).toBe('https://blob.example.com/clientes/fake.jpg');

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    expect(cliente?.fotoUrl).toBe('https://blob.example.com/clientes/fake.jpg');
  });

  it('rejects a body that is not a data URL', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId }, body: { fotoBase64: 'no-es-una-imagen' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(422);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/fotoCliente.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/clientes/[id]/foto'"

- [ ] **Step 7: Implement the foto upload endpoint**

```typescript
// api/admin/clientes/[id]/foto.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, requireRol } from '../../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };
  const { fotoBase64 } = req.body as { fotoBase64: string };

  const match = fotoBase64?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) { res.status(422).json({ error: 'La imagen no tiene un formato válido.' }); return; }

  const [, mime, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');
  const extension = mime.split('/')[1];

  const blob = await put(`clientes/${id}-${Date.now()}.${extension}`, buffer, { access: 'public', contentType: mime });
  await prisma.cliente.update({ where: { id }, data: { fotoUrl: blob.url } });

  res.status(200).json({ fotoUrl: blob.url });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/fotoCliente.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for FichaClientePage**

```typescript
// tests/src/FichaClientePage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { FichaClientePage } from '../../src/pages/FichaClientePage';
import * as apiClient from '../../src/lib/apiClient';

describe('FichaClientePage', () => {
  it('renders cliente name, stats, compras, pagos, and reservas con estado', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      cliente: {
        id: '1', nombre: 'María González', ticketsDisponibles: 2, estado: 'por_vencer', vencimiento: null,
        fotoUrl: null, clienteDesde: '2026-01-10T00:00:00.000Z', ausenciasSinAviso: 1, ultimaVisita: '2026-08-20T00:00:00.000Z',
      },
      compras: [{ id: 'c1', modalidad: { nombre: 'Pase x4' }, fechaCompra: new Date().toISOString(), precioPagado: 18000 }],
      pagos: [{ id: 'p1', medio: 'EFECTIVO', monto: 18000, descuentoAplicado: 10, createdAt: new Date().toISOString() }],
      reservas: [{ id: 'r1', fechaHora: new Date().toISOString(), tipoClase: 'Boulder', estadoAsistencia: 'PENALIZADA' }],
    });

    // FichaClientePage calls useAuth() (needs AuthProvider) and useParams() (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/clientes/1']}>
          <Routes><Route path="/admin/clientes/:id" element={<FichaClientePage />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('María González')).toBeInTheDocument());
    expect(screen.getByText('Pase x4')).toBeInTheDocument();
    expect(screen.getByText(/EFECTIVO/)).toBeInTheDocument();
    expect(screen.getByText('PENALIZADA')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // ausenciasSinAviso
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/src/FichaClientePage.test.tsx`
Expected: FAIL with "Cannot find module '../../src/pages/FichaClientePage'"

- [ ] **Step 11: Implement FotoUploader and FichaClientePage**

```typescript
// src/components/FotoUploader.tsx
import { useRef } from 'react';

export function FotoUploader({ fotoUrl, onUpload }: { fotoUrl: string | null; onUpload: (base64: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 border border-[var(--ink-line)] bg-[var(--ink-raised)] overflow-hidden flex items-center justify-center">
        {fotoUrl ? <img src={fotoUrl} alt="Foto del alumno" className="w-full h-full object-cover" /> : <span className="text-xs text-[var(--rock-dim)]">Sin foto</span>}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} className="border border-[var(--gold)] text-[var(--gold)] text-xs uppercase px-3 py-2">
        {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}
```

```typescript
// src/pages/FichaClientePage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';
import { FotoUploader } from '../components/FotoUploader';

export function FichaClientePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  async function cargar() {
    const body = await apiFetch(`/api/admin/clientes/${id}`, {}, token);
    setData(body);
  }

  useEffect(() => { cargar(); }, [id, token]);

  async function subirFoto(base64: string) {
    await apiFetch(`/api/admin/clientes/${id}/foto`, { method: 'POST', body: JSON.stringify({ fotoBase64: base64 }) }, token);
    cargar();
  }

  if (!data) return <p>Cargando…</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <FotoUploader fotoUrl={data.cliente.fotoUrl} onUpload={subirFoto} />
          <h2 className="font-['Anton'] uppercase text-2xl">{data.cliente.nombre}</h2>
        </div>
        <EstadoBadge estado={data.cliente.estado} />
      </div>

      <p className="font-mono tabular-nums text-3xl mb-4">{data.cliente.ticketsDisponibles} tickets</p>

      <div className="grid grid-cols-3 gap-3 mb-8 text-sm">
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Cliente desde</p>
          <p>{new Date(data.cliente.clienteDesde).toLocaleDateString('es-AR')}</p>
        </div>
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Ausencias sin aviso</p>
          <p className="font-mono tabular-nums">{data.cliente.ausenciasSinAviso}</p>
        </div>
        <div className="border border-[var(--ink-line)] p-3">
          <p className="text-xs uppercase text-[var(--rock-dim)] mb-1">Última visita</p>
          <p>{data.cliente.ultimaVisita ? new Date(data.cliente.ultimaVisita).toLocaleDateString('es-AR') : 'Nunca'}</p>
        </div>
      </div>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Compras</h3>
      <ul className="mb-8">
        {data.compras.map((c: any) => (
          <li key={c.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{c.modalidad.nombre}</span><span className="font-mono tabular-nums">${c.precioPagado}</span>
          </li>
        ))}
      </ul>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Pagos</h3>
      <ul className="mb-8">
        {data.pagos.map((p: any) => (
          <li key={p.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{p.medio} — {Number(p.descuentoAplicado)}% desc.</span><span className="font-mono tabular-nums">${p.monto}</span>
          </li>
        ))}
      </ul>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Reservas y asistencias</h3>
      <ul>
        {data.reservas.map((r: any) => (
          <li key={r.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{new Date(r.fechaHora).toLocaleDateString('es-AR')} — {r.tipoClase}</span>
            <span className="font-mono text-xs uppercase text-[var(--rock)]">{r.estadoAsistencia}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Add the route: `<Route path="clientes/:id" element={<FichaClientePage />} />`.

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/src/FichaClientePage.test.tsx`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add "api/admin/clientes/[id].ts" "api/admin/clientes/[id]" src/components/FotoUploader.tsx src/pages/FichaClientePage.tsx src/App.tsx tests/
git commit -m "feat: ficha de cliente con estadisticas, foto, y reservas/asistencias"
```

---

### Task 10: Reservas — Presente / Aviso ausencia / recupero por 7 días, y el cron de penalización

**Files:**
- Create: `api/admin/reservas/index.ts`, `api/admin/reservas/[id]/marcar.ts`, `api/admin/reservas/recuperar.ts`, `api/cron/penalizar-pendientes.ts`
- Create: `src/components/AsistenciaBadge.tsx`, `src/pages/ReservasPage.tsx`
- Modify: `src/App.tsx`, `vercel.json` (cron entry)
- Test: `tests/api/reservas.test.ts`, `tests/api/marcarAsistencia.test.ts`, `tests/api/recuperar.test.ts`, `tests/api/penalizarPendientes.test.ts`

**Interfaces:**
- Consumes: `siguienteFechaHabil` exported by Task 8's `api/admin/compras/index.ts`.
- Produces: `GET /api/admin/reservas?fecha=` → `{ reservas: [{ id, clienteId, clienteNombre, fechaHora, tipoClase, estadoAsistencia }] }`. `POST /api/admin/reservas/:id/marcar` body `{ estado: 'PRESENTE' | 'AVISO_AUSENCIA' }`. `POST /api/admin/reservas/recuperar` body `{ clienteId, horarioId }` for a walk-in without today's reserva. None of these three change signatures downstream — Task 12 (Dashboard) only ever reads `estadoAsistencia` and `fechaHora` off `Reserva`, both already defined in Task 2's schema.

- [ ] **Step 1: Write the failing test for listing reservas**

```typescript
// tests/api/reservas.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/reservas', () => {
  let adminToken: string;
  let clienteId: string;
  const hoy = new Date();
  hoy.setUTCHours(22, 0, 0, 0); // 19:00 ART

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'reservas-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Reserva Test', email: 'reservas-test-cliente@realization.com' } });
    clienteId = cliente.id;
    await prisma.reserva.create({ data: { clienteId, fechaHora: hoy, tipoClase: 'Boulder intermedio' } });
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'reservas-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('lists reservas for the given date with clienteNombre resolved', async () => {
    const fecha = hoy.toISOString().slice(0, 10);
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { fecha } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.reservas.some((r: any) => r.clienteNombre === 'Reserva Test')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/reservas.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/reservas/index'"

- [ ] **Step 3: Implement the reservas list endpoint**

```typescript
// api/admin/reservas/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { fecha } = req.query as { fecha: string };
  const inicio = new Date(`${fecha}T00:00:00.000Z`);
  const fin = new Date(`${fecha}T23:59:59.999Z`);

  const reservas = await prisma.reserva.findMany({
    where: { fechaHora: { gte: inicio, lte: fin } },
    include: { cliente: true },
    orderBy: { fechaHora: 'asc' },
  });

  res.status(200).json({
    reservas: reservas.map((r) => ({
      id: r.id, clienteId: r.clienteId, clienteNombre: r.cliente.nombre,
      fechaHora: r.fechaHora, tipoClase: r.tipoClase, estadoAsistencia: r.estadoAsistencia,
    })),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/reservas.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for marcar (Presente y Aviso ausencia)**

```typescript
// tests/api/marcarAsistencia.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/[id]/marcar';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/reservas/:id/marcar', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let horarioId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'marcar-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Marcar Test', email: 'marcar-test-cliente@realization.com' } });
    clienteId = cliente.id;
    const horario = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    horarioId = horario.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.horario.delete({ where: { id: horarioId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'marcar-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: { in: ['checkin_manual', 'aviso_ausencia'] } } });
    await prisma.$disconnect();
  });

  it('PRESENTE consumes the ticket and logs a check-in', async () => {
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Marcar Test x1', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    const reserva = await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, horarioId, fechaHora: new Date(), tipoClase: 'Boulder' } });

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: reserva.id }, body: { estado: 'PRESENTE' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const ticket = await prisma.ticket.findUnique({ where: { id: compra.tickets[0].id } });
    expect(ticket?.estado).toBe('CONSUMIDO');

    const actualizada = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(actualizada?.estadoAsistencia).toBe('PRESENTE');

    await prisma.checkIn.deleteMany({ where: { reservaId: reserva.id } });
    await prisma.reserva.delete({ where: { id: reserva.id } });
    await prisma.ticket.deleteMany({ where: { compraId: compra.id } });
    await prisma.compra.delete({ where: { id: compra.id } });
    await prisma.modalidad.delete({ where: { id: modalidad.id } });
  });

  it('AVISO_AUSENCIA does not consume the ticket, colors it, and appends a reserva one week later', async () => {
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Marcar Test x1 aviso', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    const fechaOriginal = new Date();
    const reserva = await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, horarioId, fechaHora: fechaOriginal, tipoClase: 'Boulder' } });

    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: reserva.id }, body: { estado: 'AVISO_AUSENCIA' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const ticket = await prisma.ticket.findUnique({ where: { id: compra.tickets[0].id } });
    expect(ticket?.estado).toBe('DISPONIBLE');

    const original = await prisma.reserva.findUnique({ where: { id: reserva.id } });
    expect(original?.estadoAsistencia).toBe('AVISO_AUSENCIA');
    expect(original?.ticketId).toBeNull();

    const nueva = await prisma.reserva.findFirst({ where: { ticketId: compra.tickets[0].id } });
    expect(nueva).not.toBeNull();
    const diffDias = (nueva!.fechaHora.getTime() - fechaOriginal.getTime()) / 86400000;
    expect(Math.round(diffDias)).toBe(7);

    await prisma.reserva.deleteMany({ where: { compra: undefined, ticketId: compra.tickets[0].id } });
    await prisma.reserva.delete({ where: { id: reserva.id } });
    await prisma.ticket.deleteMany({ where: { compraId: compra.id } });
    await prisma.compra.delete({ where: { id: compra.id } });
    await prisma.modalidad.delete({ where: { id: modalidad.id } });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/marcarAsistencia.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/reservas/[id]/marcar'"

- [ ] **Step 7: Implement the marcar endpoint**

```typescript
// api/admin/reservas/[id]/marcar.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, requireRol } from '../../../_lib/auth';
import { siguienteFechaHabil } from '../../compras/index';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { id } = req.query as { id: string };
  const { estado } = req.body as { estado: 'PRESENTE' | 'AVISO_AUSENCIA' };

  const reserva = await prisma.reserva.findUnique({ where: { id } });
  if (!reserva) { res.status(404).json({ error: 'No encontramos esa reserva.' }); return; }

  if (estado === 'PRESENTE') {
    await prisma.reserva.update({ where: { id }, data: { estadoAsistencia: 'PRESENTE' } });
    if (reserva.ticketId) {
      await prisma.ticket.update({ where: { id: reserva.ticketId }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });
    }
    await prisma.checkIn.create({ data: { clienteId: reserva.clienteId, reservaId: reserva.id, metodo: 'MANUAL' } });
    await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'checkin_manual', detalle: { reservaId: id } } });
    res.status(200).json({ ok: true });
    return;
  }

  if (estado === 'AVISO_AUSENCIA') {
    if (!reserva.horarioId) {
      res.status(422).json({ error: 'Esta reserva no tiene un horario fijo, no se puede reprogramar sola.' });
      return;
    }
    const horario = await prisma.horario.findUnique({ where: { id: reserva.horarioId } });
    const ticketId = reserva.ticketId;

    await prisma.reserva.update({ where: { id }, data: { estadoAsistencia: 'AVISO_AUSENCIA', ticketId: null } });

    const nuevaFecha = await siguienteFechaHabil(horario!.diaSemana, horario!.hora, new Date(reserva.fechaHora.getTime() + 86400000));
    await prisma.reserva.create({
      data: { clienteId: reserva.clienteId, ticketId: ticketId ?? undefined, horarioId: reserva.horarioId, fechaHora: nuevaFecha, tipoClase: reserva.tipoClase },
    });

    await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'aviso_ausencia', detalle: { reservaOriginalId: id, nuevaFecha } } });
    res.status(200).json({ ok: true, nuevaFecha });
    return;
  }

  res.status(422).json({ error: 'Estado inválido. Usá PRESENTE o AVISO_AUSENCIA.' });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/marcarAsistencia.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for recuperar (walk-in a otro horario)**

```typescript
// tests/api/recuperar.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/recuperar';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/reservas/recuperar', () => {
  let adminToken: string;
  let clienteId: string;
  let ticketId: string;
  let horarioOtroId: string;
  let reservaPendienteId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'recuperar-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Recuperar Test', email: 'recuperar-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Recuperar Test x1', tipo: 'CLASES', conZapas: false, cantTickets: 1, precio: 6000 } });
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 6000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    ticketId = compra.tickets[0].id;

    const horarioFaltado = await prisma.horario.create({ data: { diaSemana: 2, hora: '19:00', tipoClase: 'Boulder' } });
    const horarioOtro = await prisma.horario.create({ data: { diaSemana: 4, hora: '20:00', tipoClase: 'Boulder avanzado' } });
    horarioOtroId = horarioOtro.id;

    const reserva = await prisma.reserva.create({
      data: { clienteId, ticketId, horarioId: horarioFaltado.id, fechaHora: new Date(Date.now() - 3 * 86400000), tipoClase: 'Boulder' },
    });
    reservaPendienteId = reserva.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.horario.deleteMany({ where: { tipoClase: { in: ['Boulder', 'Boulder avanzado'] } } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Recuperar Test x1' } });
    await prisma.admin.delete({ where: { email: 'recuperar-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: 'recupero_clase' } });
    await prisma.$disconnect();
  });

  it('resolves the pending reserva against a walk-in at a different horario and consumes its ticket', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { clienteId, horarioId: horarioOtroId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const original = await prisma.reserva.findUnique({ where: { id: reservaPendienteId } });
    expect(original?.estadoAsistencia).toBe('RECUPERADA');

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.estado).toBe('CONSUMIDO');

    const nueva = res.json.mock.calls[0][0].reserva;
    expect(nueva.recuperaDeId).toBe(reservaPendienteId);
    expect(nueva.estadoAsistencia).toBe('PRESENTE');
  });

  it('returns 404 when the cliente has no pending falta within 7 days', async () => {
    const otroCliente = await prisma.cliente.create({ data: { nombre: 'Sin pendientes', email: 'sin-pendientes@realization.com' } });
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { clienteId: otroCliente.id, horarioId: horarioOtroId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    await prisma.cliente.delete({ where: { id: otroCliente.id } });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/api/recuperar.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/reservas/recuperar'"

- [ ] **Step 11: Implement the recuperar endpoint**

```typescript
// api/admin/reservas/recuperar.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { clienteId, horarioId } = req.body as { clienteId: string; horarioId: string };

  const horario = await prisma.horario.findUnique({ where: { id: horarioId } });
  if (!horario) { res.status(404).json({ error: 'El horario no existe.' }); return; }

  const limite = new Date(Date.now() - SIETE_DIAS_MS);
  const pendiente = await prisma.reserva.findFirst({
    where: { clienteId, estadoAsistencia: 'PENDIENTE', fechaHora: { lt: new Date(), gte: limite } },
    orderBy: { fechaHora: 'asc' },
  });

  if (!pendiente) {
    res.status(404).json({ error: 'Este alumno no tiene ninguna falta pendiente de recuperar en los últimos 7 días.' });
    return;
  }

  const ticketId = pendiente.ticketId;
  await prisma.reserva.update({ where: { id: pendiente.id }, data: { estadoAsistencia: 'RECUPERADA', ticketId: null } });

  const nueva = await prisma.reserva.create({
    data: {
      clienteId, ticketId: ticketId ?? undefined, horarioId, fechaHora: new Date(),
      tipoClase: horario.tipoClase, estadoAsistencia: 'PRESENTE', recuperaDeId: pendiente.id,
    },
  });

  if (ticketId) await prisma.ticket.update({ where: { id: ticketId }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });

  await prisma.checkIn.create({ data: { clienteId, reservaId: nueva.id, metodo: 'MANUAL' } });
  await prisma.activity.create({ data: { actorId: payload.id, actorRol: 'ADMIN', accion: 'recupero_clase', detalle: { reservaOriginalId: pendiente.id, nuevaReservaId: nueva.id } } });

  res.status(200).json({ reserva: nueva });
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/api/recuperar.test.ts`
Expected: PASS

- [ ] **Step 13: Write the failing test for the penalización cron**

```typescript
// tests/api/penalizarPendientes.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import handler from '../../api/cron/penalizar-pendientes';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('cron penalizar-pendientes', () => {
  let clienteId: string;
  let ticketVencidoId: string;
  let ticketReciente: string;

  beforeAll(async () => {
    process.env.CRON_SECRET = 'test-secret';
    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Cron Test x2', tipo: 'CLASES', conZapas: false, cantTickets: 2, precio: 12000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Cron Test', email: 'cron-test@realization.com' } });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 12000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] } },
      include: { tickets: true },
    });
    ticketVencidoId = compra.tickets[0].id;
    ticketReciente = compra.tickets[1].id;

    // falta de hace 8 dias, sin resolver -> debe penalizarse
    await prisma.reserva.create({ data: { clienteId, ticketId: ticketVencidoId, fechaHora: new Date(Date.now() - 8 * 86400000), tipoClase: 'Boulder' } });
    // falta de hace 2 dias -> todavia dentro de ventana, no se toca
    await prisma.reserva.create({ data: { clienteId, ticketId: ticketReciente, fechaHora: new Date(Date.now() - 2 * 86400000), tipoClase: 'Boulder' } });
  });

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { accion: 'penalizacion_no_show' } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Cron Test x2' } });
    await prisma.$disconnect();
  });

  it('penalizes only the reserva pending for more than 7 days', async () => {
    const req: any = { method: 'GET', headers: { authorization: 'Bearer test-secret' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const vencido = await prisma.ticket.findUnique({ where: { id: ticketVencidoId } });
    expect(vencido?.estado).toBe('PENALIZADO');

    const reciente = await prisma.ticket.findUnique({ where: { id: ticketReciente } });
    expect(reciente?.estado).toBe('DISPONIBLE');
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `CRON_SECRET=test-secret npx vitest run tests/api/penalizarPendientes.test.ts`
Expected: FAIL with "Cannot find module '../../api/cron/penalizar-pendientes'"

- [ ] **Step 15: Implement the cron handler and register it**

```typescript
// api/cron/penalizar-pendientes.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const limite = new Date(Date.now() - SIETE_DIAS_MS);
  const vencidas = await prisma.reserva.findMany({ where: { estadoAsistencia: 'PENDIENTE', fechaHora: { lt: limite } } });

  for (const r of vencidas) {
    await prisma.reserva.update({ where: { id: r.id }, data: { estadoAsistencia: 'PENALIZADA' } });
    if (r.ticketId) await prisma.ticket.update({ where: { id: r.ticketId }, data: { estado: 'PENALIZADO', consumidoAt: new Date() } });
    await prisma.activity.create({
      data: { actorId: 'system', actorRol: 'ADMIN', accion: 'penalizacion_no_show', detalle: { reservaId: r.id, clienteId: r.clienteId } },
    });
  }

  res.status(200).json({ penalizadas: vencidas.length });
}
```

**Merge** a `crons` key into the *existing* `vercel.json` from Task 1 — do not replace the file, it must keep `buildCommand`, `outputDirectory`, and `rewrites`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/$1" }],
  "crons": [{ "path": "/api/cron/penalizar-pendientes", "schedule": "0 3 * * *" }]
}
```

Set `CRON_SECRET` in Vercel env vars once deployed (`vercel env add CRON_SECRET production`); confirm at deploy time whether Vercel still auto-sends it as the `Authorization: Bearer` header for cron-triggered requests, since this convention has moved across CLI versions before.

- [ ] **Step 16: Run test to verify it passes**

Run: `CRON_SECRET=test-secret npx vitest run tests/api/penalizarPendientes.test.ts`
Expected: PASS

- [ ] **Step 17: Implement AsistenciaBadge and ReservasPage**

```typescript
// src/components/AsistenciaBadge.tsx
const LABELS: Record<string, string> = { PENDIENTE: 'Pendiente', PRESENTE: 'Presente', AVISO_AUSENCIA: 'Aviso ausencia', RECUPERADA: 'Recuperada', PENALIZADA: 'Penalizada' };
const COLORS: Record<string, string> = {
  PENDIENTE: 'text-[var(--rock)]',
  PRESENTE: 'text-[var(--good)]',
  AVISO_AUSENCIA: 'text-[var(--aviso)]',
  RECUPERADA: 'text-[var(--gold-soft)]',
  PENALIZADA: 'text-[var(--crit)]',
};

export function AsistenciaBadge({ estado }: { estado: string }) {
  return <span className={`font-mono text-xs uppercase ${COLORS[estado]}`}>{LABELS[estado]}</span>;
}
```

```typescript
// src/pages/ReservasPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { AsistenciaBadge } from '../components/AsistenciaBadge';

function hoyISO() { return new Date().toISOString().slice(0, 10); }

export function ReservasPage() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [clienteIdRecupero, setClienteIdRecupero] = useState('');
  const [horarioIdRecupero, setHorarioIdRecupero] = useState('');
  const [errorRecupero, setErrorRecupero] = useState<string | null>(null);

  async function cargar() {
    const [r, h] = await Promise.all([apiFetch(`/api/admin/reservas?fecha=${fecha}`, {}, token), apiFetch('/api/admin/horarios', {}, token)]);
    setReservas(r.reservas);
    setHorarios(h.horarios);
  }

  useEffect(() => { cargar(); }, [fecha, token]);

  async function marcar(id: string, estado: 'PRESENTE' | 'AVISO_AUSENCIA') {
    await apiFetch(`/api/admin/reservas/${id}/marcar`, { method: 'POST', body: JSON.stringify({ estado }) }, token);
    cargar();
  }

  async function handleRecupero(e: FormEvent) {
    e.preventDefault();
    setErrorRecupero(null);
    try {
      await apiFetch('/api/admin/reservas/recuperar', { method: 'POST', body: JSON.stringify({ clienteId: clienteIdRecupero, horarioId: horarioIdRecupero }) }, token);
      setClienteIdRecupero('');
      cargar();
    } catch (err) {
      setErrorRecupero((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">Reservas</h2>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2" />
      </div>

      <ul className="mb-8">
        {reservas.map((r) => (
          <li key={r.id} className="flex items-center justify-between border-t border-[var(--ink-line)] py-3 text-sm">
            <span>{new Date(r.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — {r.clienteNombre} — {r.tipoClase}</span>
            {r.estadoAsistencia === 'PENDIENTE' ? (
              <div className="flex gap-2">
                <button onClick={() => marcar(r.id, 'PRESENTE')} className="border border-[var(--good)] text-[var(--good)] text-xs uppercase px-3 py-1">Presente</button>
                <button onClick={() => marcar(r.id, 'AVISO_AUSENCIA')} className="border border-[var(--aviso)] text-[var(--aviso)] text-xs uppercase px-3 py-1">Aviso ausencia</button>
              </div>
            ) : (
              <AsistenciaBadge estado={r.estadoAsistencia} />
            )}
          </li>
        ))}
      </ul>

      <div className="border border-[var(--ink-line)] p-4">
        <p className="text-xs uppercase text-[var(--rock)] mb-3">Fichar recupero (alumno que faltó y viene hoy a otro horario)</p>
        {errorRecupero && <p className="text-[var(--crit)] text-sm mb-3">{errorRecupero}</p>}
        <form onSubmit={handleRecupero} className="flex gap-3">
          <input placeholder="ID del cliente" value={clienteIdRecupero} onChange={(e) => setClienteIdRecupero(e.target.value)}
            className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
          <select value={horarioIdRecupero} onChange={(e) => setHorarioIdRecupero(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
            <option value="">Horario de hoy</option>
            {horarios.map((h) => <option key={h.id} value={h.id}>{h.tipoClase} {h.hora}</option>)}
          </select>
          <button type="submit" className="bg-[var(--gold)] text-[var(--ink)] font-bold px-4 py-2 text-sm">Fichar recupero</button>
        </form>
      </div>
    </div>
  );
}
```

Add the route: `<Route path="reservas" element={<ReservasPage />} />`.

> Nota de implementación: `clienteIdRecupero` como input de texto libre es aceptable para el primer corte porque Dani conoce a sus alumnos; si en la práctica resulta incómodo escribir un ID a mano, el fast-follow natural es cambiarlo por un buscador con autocompletado sobre `GET /api/admin/clientes?q=`, que ya existe desde la Task 4.

- [ ] **Step 18: Commit**

```bash
git add api/admin/reservas/ api/cron/ src/components/AsistenciaBadge.tsx src/pages/ReservasPage.tsx src/App.tsx vercel.json tests/
git commit -m "feat: flujo de asistencia Presente/Aviso ausencia, recupero por 7 dias, y cron de penalizacion"
```

---

### Task 11: Cobros — una caja por medio de pago, con retiros

**Files:**
- Create: `api/admin/cobros/index.ts`, `api/admin/cobros/retiros.ts`, `src/pages/CobrosPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/cobros.test.ts`, `tests/api/retiros.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/cobros` → `{ cajas: [{ medio, entradas, retiros, saldo }], movimientos: [{ tipo: 'entrada'|'retiro', medio, monto, motivo, fecha, actorId }] }` — one row per `MedioPago` value, always all four even if a medio has zero movement. `POST /api/admin/cobros/retiros` body `{ medio, monto, motivo }` creates a `Retiro` tagged with the calling admin's id — this is deliberately **not** shared with Task 10 or Task 12 beyond that both read `Pago`/`Retiro` independently; no coupling.

- [ ] **Step 1: Write the failing test for the cajas summary**

```typescript
// tests/api/cobros.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/cobros/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/cobros', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let compraId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'cobros-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Cobros Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Cobros Test', email: 'cobros-test-cliente@realization.com' } });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        tickets: { create: Array.from({ length: 4 }, () => ({ estado: 'DISPONIBLE' as const })) },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
    });
    compraId = compra.id;

    await prisma.retiro.create({ data: { medio: 'EFECTIVO', monto: 5000, motivo: 'Pago proveedor', actorId: adminId } });
  });

  afterAll(async () => {
    await prisma.retiro.deleteMany({ where: { actorId: adminId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compraId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Cobros Test x4' } });
    await prisma.admin.delete({ where: { email: 'cobros-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('reports one caja per medio with entradas, retiros, and saldo correcto', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.cajas).toHaveLength(4);
    const efectivo = body.cajas.find((c: any) => c.medio === 'EFECTIVO');
    expect(efectivo.entradas).toBeGreaterThanOrEqual(18000);
    expect(efectivo.retiros).toBeGreaterThanOrEqual(5000);
    expect(efectivo.saldo).toBe(efectivo.entradas - efectivo.retiros);

    const mercadopago = body.cajas.find((c: any) => c.medio === 'MERCADOPAGO');
    expect(mercadopago.entradas).toBe(0);
    expect(mercadopago.saldo).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/cobros.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/cobros/index'"

- [ ] **Step 3: Implement the cajas summary endpoint**

```typescript
// api/admin/cobros/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/cobros.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for registrar un retiro**

```typescript
// tests/api/retiros.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/cobros/retiros';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/cobros/retiros', () => {
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'retiros-test@realization.com', passwordHash: 'x' } });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.retiro.deleteMany({ where: { actorId: adminId } });
    await prisma.admin.delete({ where: { email: 'retiros-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a retiro tagged with the calling admin', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: { medio: 'EFECTIVO', monto: 3000, motivo: 'Retiro personal' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);

    const retiro = await prisma.retiro.findFirst({ where: { actorId: adminId } });
    expect(retiro?.motivo).toBe('Retiro personal');
    expect(Number(retiro?.monto)).toBe(3000);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/retiros.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/cobros/retiros'"

- [ ] **Step 7: Implement the retiros endpoint**

```typescript
// api/admin/cobros/retiros.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const { medio, monto, motivo } = req.body as { medio: string; monto: number; motivo: string };
  const retiro = await prisma.retiro.create({ data: { medio: medio as any, monto, motivo, actorId: payload.id } });
  res.status(201).json({ retiro });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/retiros.test.ts`
Expected: PASS

- [ ] **Step 9: Implement CobrosPage (manual verification, mirrors the interaction pattern already tested in ReservasPage/HorariosPage)**

```typescript
// src/pages/CobrosPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

const NOMBRES: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', MERCADOPAGO: 'Mercado Pago' };

export function CobrosPage() {
  const { token } = useAuth();
  const [cajas, setCajas] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [medio, setMedio] = useState('EFECTIVO');
  const [monto, setMonto] = useState(0);
  const [motivo, setMotivo] = useState('');

  async function cargar() {
    const data = await apiFetch('/api/admin/cobros', {}, token);
    setCajas(data.cajas);
    setMovimientos(data.movimientos);
  }

  useEffect(() => { cargar(); }, [token]);

  async function handleRetiro(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/cobros/retiros', { method: 'POST', body: JSON.stringify({ medio, monto, motivo }) }, token);
    setMonto(0);
    setMotivo('');
    cargar();
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Cobros</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {cajas.map((c) => (
          <div key={c.medio} className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-4">
            <p className="text-xs uppercase text-[var(--rock)] mb-2">{NOMBRES[c.medio]}</p>
            <p className="font-mono tabular-nums text-2xl">${c.saldo.toLocaleString('es-AR')}</p>
            <p className="text-xs text-[var(--rock-dim)] mt-1">+${c.entradas.toLocaleString('es-AR')} / -${c.retiros.toLocaleString('es-AR')}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleRetiro} className="flex gap-3 mb-8 flex-wrap">
        <select value={medio} onChange={(e) => setMedio(e.target.value)} className="bg-[var(--ink)] border border-[var(--ink-line)] px-3 py-2 text-sm">
          {Object.keys(NOMBRES).map((m) => <option key={m} value={m}>{NOMBRES[m]}</option>)}
        </select>
        <input type="number" placeholder="Monto" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <input placeholder="Motivo del retiro" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="flex-1 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-sm" />
        <button type="submit" className="border border-[var(--crit)] text-[var(--crit)] text-sm uppercase px-4 py-2">Registrar retiro</button>
      </form>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Movimientos</h3>
      <ul>
        {movimientos.map((m, i) => (
          <li key={i} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{NOMBRES[m.medio]} — {m.motivo}</span>
            <span className={`font-mono tabular-nums ${m.tipo === 'entrada' ? 'text-[var(--good)]' : 'text-[var(--crit)]'}`}>
              {m.tipo === 'entrada' ? '+' : '-'}${m.monto.toLocaleString('es-AR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Add the route: `<Route path="cobros" element={<CobrosPage />} />`.

- [ ] **Step 10: Commit**

```bash
git add api/admin/cobros/ src/pages/CobrosPage.tsx src/App.tsx tests/
git commit -m "feat: cobros — una caja por medio de pago con retiros"
```

---

### Task 12: Dashboard "Hoy" — el tablero gráfico con mucho dato

**Files:**
- Create: `api/admin/dashboard/hoy.ts`, `src/components/StatTile.tsx`, `src/components/IngresosSparkline.tsx`, `src/pages/DashboardHoyPage.tsx`
- Modify: `src/App.tsx` (replace the `index` placeholder route)
- Test: `tests/api/dashboardHoy.test.ts`, `tests/src/DashboardHoyPage.test.tsx`

**Interfaces:**
- Produces: `GET /api/admin/dashboard/hoy` → `{ checkInsHoy, reservasHoy, cobrosHoyTotal, cobrosHoyPorMedio, alumnosAlerta: [{id, nombre, estado, ticketsDisponibles}], pendientesDeRecuperar: [{clienteId, clienteNombre, fechaHora, diasRestantes}], ingresosUltimos7Dias: [{fecha, total}], checkInsRecientes: [{clienteNombre, timestamp}] }`. Last task that reads data — nothing downstream depends on this one.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/dashboardHoy.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/dashboard/hoy';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/admin/dashboard/hoy', () => {
  let adminToken: string;
  let clienteId: string;
  let compraId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({ data: { nombre: 'Test', email: 'dashboard-test@realization.com', passwordHash: 'x' } });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({ data: { nombre: 'Dashboard Test x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000 } });
    const cliente = await prisma.cliente.create({ data: { nombre: 'Dashboard Test Cliente', email: 'dashboard-test-cliente@realization.com' } });
    clienteId = cliente.id;

    const compra = await prisma.compra.create({
      data: { clienteId, modalidadId: modalidad.id, vencimiento: new Date(Date.now() + 30 * 86400000), precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } } },
      include: { tickets: true },
    });
    compraId = compra.id;

    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL' } });
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[0].id, fechaHora: new Date(), tipoClase: 'Boulder' } });
    // una falta pendiente de hace 3 dias, todavia dentro de la ventana de 7
    await prisma.reserva.create({ data: { clienteId, ticketId: compra.tickets[1].id, fechaHora: new Date(Date.now() - 3 * 86400000), tipoClase: 'Boulder' } });
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compraId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Dashboard Test x4' } });
    await prisma.admin.delete({ where: { email: 'dashboard-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('aggregates checkins, reservas, cobros, alertas de saldo, pendientes de recuperar, e ingresos de 7 dias', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.checkInsHoy).toBeGreaterThanOrEqual(1);
    expect(body.reservasHoy).toBeGreaterThanOrEqual(1);
    expect(body.cobrosHoyTotal).toBeGreaterThanOrEqual(18000);
    expect(body.cobrosHoyPorMedio.EFECTIVO).toBeGreaterThanOrEqual(18000);
    expect(body.alumnosAlerta.some((a: any) => a.id === clienteId)).toBe(true);
    expect(body.pendientesDeRecuperar.some((p: any) => p.clienteId === clienteId && p.diasRestantes === 4)).toBe(true);
    expect(body.ingresosUltimos7Dias).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/dashboardHoy.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/dashboard/hoy'"

- [ ] **Step 3: Implement the dashboard aggregation endpoint**

```typescript
// api/admin/dashboard/hoy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta';

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido.' }); return; }

  const hoyInicio = inicioDelDia(new Date());
  const hoyFin = new Date(hoyInicio.getTime() + 86400000);

  const [checkInsHoy, reservasHoy, pagosHoy, clientes, checkInsRecientes, pendientes] = await Promise.all([
    prisma.checkIn.count({ where: { timestamp: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.reserva.count({ where: { fechaHora: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.pago.findMany({ where: { createdAt: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.cliente.findMany({ include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } } }),
    prisma.checkIn.findMany({ where: { timestamp: { gte: hoyInicio, lt: hoyFin } }, include: { cliente: true }, orderBy: { timestamp: 'desc' }, take: 10 }),
    prisma.reserva.findMany({ where: { estadoAsistencia: 'PENDIENTE', fechaHora: { lt: new Date() } }, include: { cliente: true }, orderBy: { fechaHora: 'asc' } }),
  ]);

  const cobrosHoyTotal = pagosHoy.reduce((sum, p) => sum + Number(p.monto), 0);
  const cobrosHoyPorMedio: Record<string, number> = {};
  for (const p of pagosHoy) cobrosHoyPorMedio[p.medio] = (cobrosHoyPorMedio[p.medio] ?? 0) + Number(p.monto);

  const alumnosAlerta = clientes
    .map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
      const estado = calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null);
      return { id: c.id, nombre: c.nombre, estado, ticketsDisponibles };
    })
    .filter((c) => c.estado !== 'activo');

  const pendientesDeRecuperar = pendientes.map((r) => ({
    clienteId: r.clienteId,
    clienteNombre: r.cliente.nombre,
    fechaHora: r.fechaHora,
    diasRestantes: Math.max(0, 7 - Math.floor((Date.now() - r.fechaHora.getTime()) / 86400000)),
  }));

  const ingresosUltimos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const dia = new Date(hoyInicio.getTime() - i * 86400000);
    const diaFin = new Date(dia.getTime() + 86400000);
    const pagosDia = await prisma.pago.findMany({ where: { createdAt: { gte: dia, lt: diaFin } } });
    ingresosUltimos7Dias.push({ fecha: dia.toISOString().slice(0, 10), total: pagosDia.reduce((sum, p) => sum + Number(p.monto), 0) });
  }

  res.status(200).json({
    checkInsHoy, reservasHoy, cobrosHoyTotal, cobrosHoyPorMedio, alumnosAlerta, pendientesDeRecuperar, ingresosUltimos7Dias,
    checkInsRecientes: checkInsRecientes.map((c) => ({ clienteNombre: c.cliente.nombre, timestamp: c.timestamp })),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/dashboardHoy.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for DashboardHoyPage**

```typescript
// tests/src/DashboardHoyPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { DashboardHoyPage } from '../../src/pages/DashboardHoyPage';
import * as apiClient from '../../src/lib/apiClient';

describe('DashboardHoyPage', () => {
  it('renders stat tiles, alertas de saldo, y pendientes de recuperar', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      checkInsHoy: 5, reservasHoy: 8, cobrosHoyTotal: 54000,
      cobrosHoyPorMedio: { EFECTIVO: 36000, TRANSFERENCIA: 18000 },
      alumnosAlerta: [{ id: '1', nombre: 'Julián R.', estado: 'por_vencer', ticketsDisponibles: 2 }],
      pendientesDeRecuperar: [{ clienteId: '2', clienteNombre: 'Nico F.', fechaHora: new Date().toISOString(), diasRestantes: 4 }],
      ingresosUltimos7Dias: Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-08-${16 + i}`, total: 10000 * i })),
      checkInsRecientes: [{ clienteNombre: 'María G.', timestamp: new Date().toISOString() }],
    });

    // DashboardHoyPage calls useAuth() (needs AuthProvider) and renders <Link> (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter><DashboardHoyPage /></MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Julián R.')).toBeInTheDocument();
    expect(screen.getByText('Nico F.')).toBeInTheDocument();
    expect(screen.getByText(/4 días/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/src/DashboardHoyPage.test.tsx`
Expected: FAIL with "Cannot find module '../../src/pages/DashboardHoyPage'"

- [ ] **Step 7: Implement StatTile, IngresosSparkline, and DashboardHoyPage**

```typescript
// src/components/StatTile.tsx
export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
      <p className="font-mono tabular-nums text-4xl mb-1">{value}</p>
      <p className="text-xs uppercase text-[var(--rock)]">{label}</p>
    </div>
  );
}
```

```typescript
// src/components/IngresosSparkline.tsx
type Punto = { fecha: string; total: number };

export function IngresosSparkline({ datos }: { datos: Punto[] }) {
  const max = Math.max(...datos.map((d) => d.total), 1);
  return (
    <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
      <p className="text-xs uppercase text-[var(--rock)] mb-3">Ingresos — últimos 7 días</p>
      <div className="flex items-end gap-2 h-24">
        {datos.map((d) => (
          <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-[var(--gold)]" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? '4px' : '1px' }} title={`$${d.total}`} />
            <span className="text-[10px] text-[var(--rock-dim)] font-mono">{d.fecha.slice(8, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```typescript
// src/pages/DashboardHoyPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { StatTile } from '../components/StatTile';
import { IngresosSparkline } from '../components/IngresosSparkline';
import { EstadoBadge } from '../components/EstadoBadge';

export function DashboardHoyPage() {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => { apiFetch('/api/admin/dashboard/hoy', {}, token).then(setData); }, [token]);

  if (!data) return <p>Cargando…</p>;

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Hoy</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatTile label="Check-ins hoy" value={data.checkInsHoy} />
        <StatTile label="Reservas hoy" value={data.reservasHoy} />
        <StatTile label="Cobrado hoy" value={`$${data.cobrosHoyTotal.toLocaleString('es-AR')}`} />
        <StatTile label="Alumnos en alerta" value={data.alumnosAlerta.length} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <IngresosSparkline datos={data.ingresosUltimos7Dias} />
        <div className="border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
          <p className="text-xs uppercase text-[var(--rock)] mb-3">Check-ins recientes</p>
          <ul className="text-sm space-y-2">
            {data.checkInsRecientes.map((c: any, i: number) => (
              <li key={i} className="flex justify-between">
                <span>{c.clienteNombre}</span>
                <span className="font-mono tabular-nums text-[var(--rock)]">{new Date(c.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--rock)] p-4 border-b border-[var(--ink-line)]">Alumnos que necesitan atención</p>
          <table className="w-full text-sm">
            <tbody>
              {data.alumnosAlerta.map((a: any) => (
                <tr key={a.id} className="border-t border-[var(--ink-line)]">
                  <td className="p-4"><Link to={`/admin/clientes/${a.id}`} className="hover:text-[var(--gold)]">{a.nombre}</Link></td>
                  <td className="p-4 font-mono tabular-nums">{a.ticketsDisponibles} tickets</td>
                  <td className="p-4"><EstadoBadge estado={a.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-[var(--ink-line)]">
          <p className="text-xs uppercase text-[var(--aviso)] p-4 border-b border-[var(--ink-line)]">Faltas pendientes de recuperar</p>
          <table className="w-full text-sm">
            <tbody>
              {data.pendientesDeRecuperar.map((p: any, i: number) => (
                <tr key={i} className="border-t border-[var(--ink-line)]">
                  <td className="p-4"><Link to={`/admin/clientes/${p.clienteId}`} className="hover:text-[var(--gold)]">{p.clienteNombre}</Link></td>
                  <td className="p-4 font-mono tabular-nums text-[var(--aviso)]">{p.diasRestantes} días</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

Replace the placeholder `index` route in `src/App.tsx`: `<Route index element={<DashboardHoyPage />} />`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/src/DashboardHoyPage.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add api/admin/dashboard/ src/components/StatTile.tsx src/components/IngresosSparkline.tsx src/pages/DashboardHoyPage.tsx src/App.tsx tests/
git commit -m "feat: dashboard Hoy — stat tiles, sparkline, alertas de saldo y de recupero pendiente"
```

---

### Task 13: Deploy and smoke-check on Vercel

**Files:**
- Modify: `index.html` (must be the Vite entry from Task 1 — the repo currently has the brand book copied to root as a placeholder; remove that duplicate).
- No new automated test — this task's verification is the live smoke check below.

- [ ] **Step 1: Confirm the old static landing doesn't collide with the Vite build**

Run: `git log --oneline -- index.html` to see whether `index.html` at the repo root is still the brand-book placeholder from before this plan existed. If so:

```bash
git rm index.html
```

Then re-create it directly from Task 1 Step 8's content (do not rely on `git checkout` against old commits — just paste that exact file).

- [ ] **Step 2: Set environment variables in Vercel**

```bash
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add CRON_SECRET production
vercel env add BLOB_READ_WRITE_TOKEN production
```

`DATABASE_URL` is the Neon pooled connection string. `BLOB_READ_WRITE_TOKEN` comes from enabling Vercel Blob storage on this project in the Vercel dashboard (Storage tab → Create → Blob) — it auto-populates this env var, but confirm it's present before deploying Task 9's foto upload.

- [ ] **Step 3: Push to main and let auto-deploy build**

```bash
git push
```

If the build fails, run: `vercel inspect --logs <deployment-url>` (the URL prints in the push/deploy output) to read the error.

- [ ] **Step 4: Run the seed against production once, manually**

Run: `DATABASE_URL="<same pooled URL>" npx tsx prisma/seed.ts`
Expected: no error; creates the Dani admin login for production use.

- [ ] **Step 5: Smoke-check the live site**

Visit `https://realization-pass-control.vercel.app/login`, log in with `dani@realization.com` / `realization2026`, and confirm: Hoy dashboard loads with real numbers (including a "faltas pendientes de recuperar" table, even if empty), Alumnos lists María with working search/filter, her ficha shows the three stat boxes (cliente desde / ausencias sin aviso / última visita) and a foto uploader, Horarios and Calendario pages load, Cobros shows four cajas at $0, Planes lists the seeded modalidades.

- [ ] **Step 6: Commit the cleanup if Step 1 required changes**

```bash
git add index.html
git commit -m "chore: remove brand-book placeholder now that the real admin app is live"
git push
```

---

## Self-Review Notes (v2)

- **Spec coverage:** search + filtro de estado en Alumnos (Task 4); estadísticas cliente-desde/ausencias-sin-aviso/última-visita y foto subida por Dani en la ficha (Task 9); horarios con profesor-etiqueta y cupo 40 (Task 6); calendario operativo con días de seteo (cierre total) y feriados (solo aviso, entrada manual mientras se define el proveedor de la API) (Task 7); venta de pase que exige horario para Clases y genera reservas semanales (Task 8); el flujo completo de asistencia Presente / Aviso ausencia (reprograma sola, colorea naranja, no consume ticket) / falta sin marcar (alerta, ventana de 7 días, recupero en cualquier horario, penalización automática si vence el plazo) (Task 10); cobros con una caja por medio de pago y retiros con responsable (Task 11); dashboard "Hoy" gráfico con las dos tablas de alerta (Task 12).
- **Explicitly deferred and stated as such, not silently dropped:** login de Profesor, cierre formal de caja con conteo físico, proveedor definitivo de la API de feriados, QR/GPS, Mercado Pago en vivo — todos figuran en Global Constraints con la razón de por qué quedan afuera.
- **Placeholder scan:** cada step tiene código real y comandos exactos; la única nota "queda como decisión del implementador" (Task 10, elegir cliente por ID en vez de buscador) está señalada explícitamente como tal, con la alternativa concreta ya identificada, no como un TODO vacío.
- **Type consistency:** `EstadoCuenta` (Task 4/9/12), `EstadoAsistencia` (Task 2/8/9/10/12), y `TokenPayload`/`apiFetch` (Task 3, reusado en cada página) usan los mismos nombres y valores en todas las tareas que los tocan. `siguienteFechaHabil` se define una sola vez (Task 8) y se importa (Task 10) en lugar de duplicarse.

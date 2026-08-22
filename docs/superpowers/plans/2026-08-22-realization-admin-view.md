# Realization Admin View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Admin app (Dani's tool) for Realization Pass Control — auth, clientes with ficha + cuenta corriente, venta de pases, reservas with manual check-in override, planes, and a data-dense "Hoy" dashboard.

**Architecture:** Monorepo on the existing repo (`realization-pass-control`). A Vite + React 18 + TS admin SPA at the repo root, an Express + TS API under `/api` deployed as Vercel Serverless Functions in the same Vercel project, and a Prisma schema shared by both against Neon Postgres. The Client app (separate plan) will get its own Vite app and, most likely, its own Vercel project later — nothing here blocks that.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, React Router, Express, Prisma v7, Neon Postgres, JWT (`jsonwebtoken`), `bcryptjs`, Vitest + React Testing Library (frontend), Vitest + Supertest (backend).

## Global Constraints

- **Roles are physically separate apps/pages** — no hiding admin-only UI with CSS. This plan only builds the Admin app; there is no shared page component with the future Client app.
- **Brand tokens are fixed, not negotiable** — colors: Ink Black `#0B0B0C`, Summit Gold `#F1B400`, Chalk White `#F3F0E8`, Rock Grey `#A49C8A`; state colors (separate from the brand accent, never gold): Good `#4FAE6D`, Warn `#D97B29`, Critical `#E1503D`. Fonts via Google Fonts: display `Anton`, body `Manrope`, utility/mono `JetBrains Mono`. Full reference: `shared/brand/brand-manual.html`.
- **No rounded corners, no illustrated/emoji icons** — sharp corners (`border-radius: 0`) everywhere except the isotipo's own circular mask; status indicators are typographic or square, never emoji.
- **Dark theme only** — no light mode toggle, no light palette. Match the brand book.
- **Ticket is a first-class entity**, never a counter on Plan/Modalidad — every consumption must be traceable to one row.
- **Cuenta corriente is the core system** — every UI decision defers to "can Dani see this alumno's balance and history at a glance."
- **Copy rules** (from the brand book voice section): name things by what the user sees ("Fichar entrada", not "Registrar evento"); errors explain what happened and how to fix it, never a raw code.
- **Vercel serverless gotcha**: any side effect (email, log write) after the main DB write must be `await`-ed before the handler returns — never fire-and-forget with a bare `.catch(() => {})`.
- **Timezone gotcha**: Postgres/Neon stores UTC; local dev and the business run in UTC-3. Every date read from Prisma in a script or test must be treated as UTC and converted explicitly — never compare a `Date` from Prisma to a naive local `new Date()` string.
- **Out of scope for this plan** (explicitly deferred, do not build): QR/GPS check-in, Mercado Pago live integration (the `Pago.mpReferenceId` field exists but nothing calls the MP API yet), reports/analytics beyond the Hoy dashboard, multi-sucursal, PROFESOR role, gamification (racha lives in the Client plan, not here).

---

## File Structure

```
realization-pass-control/
├── api/
│   ├── _lib/
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── auth.ts              # JWT sign/verify, requireAuth, requireRol
│   │   └── estadoCuenta.ts      # estado-de-cuenta calculation shared logic
│   ├── auth/
│   │   └── login.ts             # POST /api/auth/login
│   ├── admin/
│   │   ├── clientes/
│   │   │   ├── index.ts         # GET (list+filter), POST (alta)
│   │   │   └── [id].ts          # GET (ficha completa)
│   │   ├── modalidades/
│   │   │   └── index.ts         # GET, POST, PATCH (toggle activo / precio)
│   │   ├── compras/
│   │   │   └── index.ts         # POST (venta de pase: compra+tickets+pago)
│   │   ├── reservas/
│   │   │   ├── index.ts         # GET ?fecha=
│   │   │   └── [id]/checkin.ts  # POST override manual
│   │   └── dashboard/
│   │       └── hoy.ts           # GET agregados del día
│   └── health.ts                # GET /api/health
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/                          # Admin Vite React app
│   ├── main.tsx
│   ├── App.tsx
│   ├── lib/
│   │   ├── apiClient.ts
│   │   └── AuthContext.tsx
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   ├── AdminLayout.tsx
│   │   ├── EstadoBadge.tsx
│   │   └── StatTile.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── ClientesPage.tsx
│       ├── FichaClientePage.tsx
│       ├── ModalidadesPage.tsx
│       ├── ReservasPage.tsx
│       └── DashboardHoyPage.tsx
├── tests/
│   ├── api/
│   └── src/
├── index.html                    # Vite entry (replaces the brand-book placeholder)
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── package.json
└── vercel.json
```

One file, one job: every `api/**` file is a single route handler; every `pages/**` file is one screen; shared logic (estado de cuenta, auth) lives in `api/_lib` so both the clientes list and the ficha endpoint compute it identically.

---

### Task 1: Project scaffold — Vite admin app + Express-on-Vercel API + tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `vercel.json`
- Create: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `api/health.ts`
- Test: `tests/api/health.test.ts`, `tests/src/App.test.tsx`
- Modify: `.gitignore` (add `node_modules/`, `.vercel/`, `dist/` — already present from the earlier setup, verify)

**Interfaces:**
- Produces: `api/health.ts` exports a default handler `(req: VercelRequest, res: VercelResponse) => void` returning `{ status: 'ok' }`. Every later API task follows this same signature.
- Produces: `src/App.tsx` exports a default `App` component mounted at `#root`. Every later page task adds a `<Route>` inside it.

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
npm init -y
npm install react react-dom react-router-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
npm install -D tailwindcss@4 @tailwindcss/postcss postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install -D @vercel/node
npm install -D supertest @types/supertest
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
    const req: any = { method: 'GET' };
    const res = mockRes();
    handler(req, res);
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
  it('renders the Realization Admin title', () => {
    render(<App />);
    expect(screen.getByText(/Realization Admin/i)).toBeInTheDocument();
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

export default defineConfig({
  plugins: [react()],
});
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
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
}

body {
  background: var(--ink);
  color: var(--chalk);
  font-family: 'Manrope', -apple-system, sans-serif;
}
```

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
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
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "api", "tests", "prisma"]
}
```

```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/$1" }]
}
```

Add to `package.json` `scripts`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/src/App.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json tailwind.config.ts postcss.config.js vercel.json index.html src/ api/health.ts tests/ .gitignore
git commit -m "chore: scaffold Vite admin app and Express-on-Vercel API"
```

---

### Task 2: Prisma schema + Neon connection + seed data

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `api/_lib/prisma.ts`
- Test: `tests/api/seed.test.ts`
- Modify: `package.json` (add `prisma`, `@prisma/client`, seed script)

**Interfaces:**
- Consumes: nothing (this is the foundation every later task reads from).
- Produces: `api/_lib/prisma.ts` exports a singleton `prisma: PrismaClient`. Produces Prisma models `Admin`, `Cliente`, `Modalidad`, `Compra`, `Ticket`, `Reserva`, `CheckIn`, `Pago`, `Activity` with the exact field names used by every later task (see schema below — copy field names verbatim).

- [ ] **Step 1: Install Prisma and set the connection string**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

Set `DATABASE_URL` in `.env` (Neon pooled connection string — get it from the Neon dashboard for this project) and add `.env` to `.gitignore` if not already there.

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

model Admin {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Cliente {
  id        String    @id @default(cuid())
  nombre    String
  email     String    @unique
  telefono  String?
  createdAt DateTime  @default(now())
  compras   Compra[]
  reservas  Reserva[]
  checkIns  CheckIn[]
  pagos     Pago[]
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
  id         String    @id @default(cuid())
  clienteId  String
  cliente    Cliente   @relation(fields: [clienteId], references: [id])
  ticketId   String?   @unique
  ticket     Ticket?   @relation(fields: [ticketId], references: [id])
  fechaHora  DateTime
  tipoClase  String
  asistio    Boolean   @default(false)
  aviso24hs  Boolean   @default(false)
  checkIn    CheckIn?
  createdAt  DateTime  @default(now())
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

Run: `npx prisma migrate dev --name init`
Expected: migration applies, prints "Your database is now in sync with your schema."

- [ ] **Step 4: Create the Prisma client singleton**

```typescript
// api/_lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Write the failing seed test**

```typescript
// tests/api/seed.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { runSeed } from '../../prisma/seed';

describe('seed script', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates one admin, three modalidades, and one cliente with an active compra of 12 tickets', async () => {
    const admin = await prisma.admin.findUnique({ where: { email: 'dani@realization.com' } });
    expect(admin).not.toBeNull();

    const modalidades = await prisma.modalidad.findMany();
    expect(modalidades.length).toBeGreaterThanOrEqual(3);

    const cliente = await prisma.cliente.findUnique({
      where: { email: 'maria@example.com' },
      include: { compras: { include: { tickets: true } } },
    });
    expect(cliente).not.toBeNull();
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
    where: { id: 'seed-pase-x12' },
    update: {},
    create: {
      id: 'seed-pase-x12',
      nombre: 'Pase x12',
      tipo: 'LIBRE',
      conZapas: false,
      cantTickets: 12,
      precio: 45000,
    },
  });

  await prisma.modalidad.upsert({
    where: { id: 'seed-clase-suelta' },
    update: {},
    create: {
      id: 'seed-clase-suelta',
      nombre: 'Clase suelta',
      tipo: 'CLASES',
      conZapas: true,
      cantTickets: 1,
      precio: 6000,
    },
  });

  await prisma.modalidad.upsert({
    where: { id: 'seed-pase-x4' },
    update: {},
    create: {
      id: 'seed-pase-x4',
      nombre: 'Pase x4',
      tipo: 'LIBRE',
      conZapas: false,
      cantTickets: 4,
      precio: 18000,
    },
  });

  const cliente = await prisma.cliente.upsert({
    where: { email: 'maria@example.com' },
    update: {},
    create: { nombre: 'María González', email: 'maria@example.com', telefono: '1122334455' },
  });

  const vencimiento = new Date();
  vencimiento.setDate(vencimiento.getDate() + 60);

  const compra = await prisma.compra.create({
    data: {
      clienteId: cliente.id,
      modalidadId: paseX12.id,
      vencimiento,
      precioPagado: paseX12.precio,
      tickets: {
        create: Array.from({ length: 12 }, () => ({ estado: 'DISPONIBLE' as const })),
      },
    },
  });

  await prisma.pago.create({
    data: {
      clienteId: cliente.id,
      compraId: compra.id,
      monto: paseX12.precio,
      medio: 'EFECTIVO',
      descuentoAplicado: 10,
    },
  });
}

if (require.main === module) {
  runSeed()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/seed.test.ts`
Expected: PASS

- [ ] **Step 9: Add the seed script to package.json and commit**

```json
"scripts": {
  "db:seed": "tsx prisma/seed.ts"
}
```

```bash
npm install -D tsx
git add prisma/ api/_lib/prisma.ts tests/api/seed.test.ts package.json package-lock.json
git commit -m "feat: add Prisma schema, Neon connection, and seed data"
```

---

### Task 3: Auth — JWT login + middleware + frontend shell

**Files:**
- Create: `api/_lib/auth.ts`, `api/auth/login.ts`
- Create: `src/lib/apiClient.ts`, `src/lib/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/AdminLayout.tsx`, `src/pages/LoginPage.tsx`
- Modify: `src/App.tsx` (add routing)
- Test: `tests/api/login.test.ts`, `tests/src/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `prisma` from `api/_lib/prisma.ts` (Task 2); `Admin` model fields `email`, `passwordHash`, `id`.
- Produces: `api/_lib/auth.ts` exports `signToken(payload: { id: string; rol: 'ADMIN' | 'CLIENTE' }): string`, `verifyToken(token: string): { id: string; rol: string } | null`, `requireAuth(req, res, next)`, `requireRol(rol: string)`. Every later `api/admin/**` route wraps its handler with these.
- Produces: `src/lib/AuthContext.tsx` exports `useAuth()` returning `{ token, rol, login(email, password), logout() }`. Every later page uses `useAuth()` for the token.

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
    const payload = verifyToken(token);
    expect(payload?.rol).toBe('ADMIN');
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
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
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

type AuthState = {
  token: string | null;
  nombre: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

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
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-[var(--ink-line)] p-8">
        <h1 className="font-['Anton'] uppercase text-3xl mb-6">Realization</h1>
        {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)]"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)]"
        />
        <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3">
          Entrar
        </button>
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
  { to: '/admin/modalidades', label: 'Planes' },
];

export function AdminLayout() {
  const { nombre, logout } = useAuth();
  return (
    <div className="min-h-screen flex">
      <nav className="w-56 border-r border-[var(--ink-line)] p-4 flex flex-col">
        <h1 className="font-['Anton'] uppercase text-xl mb-8">Realization</h1>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `py-2 text-sm uppercase tracking-wide ${isActive ? 'text-[var(--gold)]' : 'text-[var(--rock)]'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto text-xs text-[var(--rock-dim)]">
          <p>{nombre}</p>
          <button onClick={logout} className="underline mt-2">Salir</button>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
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
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<div>Hoy (Task 9)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

Update the App smoke test from Task 1 (it now needs a router context):

```typescript
// tests/src/App.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('App', () => {
  it('renders the login screen by default', () => {
    render(<App />);
    expect(screen.getByText(/Realization/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/src/ProtectedRoute.test.tsx tests/src/App.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
git add api/_lib/auth.ts api/auth/ src/ tests/ package.json package-lock.json
git commit -m "feat: JWT auth (backend) and login/protected-route shell (frontend)"
```

---

### Task 4: Clientes — listado con estado de cuenta + alta

**Files:**
- Create: `api/_lib/estadoCuenta.ts`, `api/admin/clientes/index.ts`
- Create: `src/components/EstadoBadge.tsx`, `src/pages/ClientesPage.tsx`
- Modify: `src/App.tsx` (add `/admin/clientes` route)
- Test: `tests/api/estadoCuenta.test.ts`, `tests/api/clientes.test.ts`, `tests/src/ClientesPage.test.tsx`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`requireRol` (Task 3).
- Produces: `api/_lib/estadoCuenta.ts` exports `calcularEstadoCuenta(ticketsDisponibles: number, vencimiento: Date | null): 'activo' | 'por_vencer' | 'vencido'`. Task 5 (Ficha) and Task 9 (Dashboard) both call this — same three string values, nothing else.
- Produces: `GET /api/admin/clientes` returns `{ clientes: Array<{ id, nombre, email, ticketsDisponibles, vencimiento, estado }> }`. Task 5 links to `/admin/clientes/:id` using this `id`.

- [ ] **Step 1: Write the failing test for estado de cuenta**

```typescript
// tests/api/estadoCuenta.test.ts
import { describe, it, expect } from 'vitest';
import { calcularEstadoCuenta } from '../../api/_lib/estadoCuenta';

describe('calcularEstadoCuenta', () => {
  it('is "vencido" when there are no tickets disponibles', () => {
    expect(calcularEstadoCuenta(0, new Date(Date.now() + 30 * 86400000))).toBe('vencido');
  });

  it('is "vencido" when the vencimiento already passed, even with tickets left', () => {
    expect(calcularEstadoCuenta(5, new Date(Date.now() - 86400000))).toBe('vencido');
  });

  it('is "por_vencer" when 2 or fewer tickets remain or vencimiento is within 7 days', () => {
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
  if (ticketsDisponibles <= UMBRAL_TICKETS_BAJOS || vencimiento.getTime() - Date.now() <= SIETE_DIAS_MS) {
    return 'por_vencer';
  }
  return 'activo';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/estadoCuenta.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the clientes list endpoint**

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
  let clienteId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'clientes-test-admin@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 10000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Cliente Test', email: 'clientes-test-cliente@realization.com' },
    });
    clienteId = cliente.id;
    await prisma.compra.create({
      data: {
        clienteId: cliente.id,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 30 * 86400000),
        precioPagado: 10000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'CONSUMIDO' }] },
      },
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'clientes-test-admin@realization.com' } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Test x4' } });
    await prisma.$disconnect();
  });

  it('lists clientes with computed estado and rejects missing auth', async () => {
    const resNoAuth = mockRes();
    await handler({ method: 'GET', headers: {} } as any, resNoAuth);
    expect(resNoAuth.status).toHaveBeenCalledWith(401);

    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${adminToken}` } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    const found = body.clientes.find((c: any) => c.id === clienteId);
    expect(found.ticketsDisponibles).toBe(1);
    expect(found.estado).toBe('por_vencer');
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
import { calcularEstadoCuenta } from '../../_lib/estadoCuenta';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method === 'GET') {
    const clientes = await prisma.cliente.findMany({
      include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } },
      orderBy: { nombre: 'asc' },
    });

    const result = clientes.map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra
        ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length
        : 0;
      return {
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        ticketsDisponibles,
        vencimiento: ultimaCompra?.vencimiento ?? null,
        estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
      };
    });

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

- [ ] **Step 9: Write the failing test for the ClientesPage**

```typescript
// tests/src/ClientesPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientesPage } from '../../src/pages/ClientesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ClientesPage', () => {
  it('renders one row per cliente with the estado badge colored by state', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      clientes: [
        { id: '1', nombre: 'María', email: 'm@x.com', ticketsDisponibles: 8, vencimiento: null, estado: 'activo' },
        { id: '2', nombre: 'Julián', email: 'j@x.com', ticketsDisponibles: 2, vencimiento: null, estado: 'por_vencer' },
        { id: '3', nombre: 'Nico', email: 'n@x.com', ticketsDisponibles: 0, vencimiento: null, estado: 'vencido' },
      ],
    });

    render(<ClientesPage />);

    await waitFor(() => expect(screen.getByText('María')).toBeInTheDocument());
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Por vencer')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
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
  return (
    <span className={`font-mono text-xs uppercase px-2 py-1 ${COLORS[estado]}`}>
      {LABELS[estado]}
    </span>
  );
}
```

```typescript
// src/pages/ClientesPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';

type ClienteRow = {
  id: string;
  nombre: string;
  email: string;
  ticketsDisponibles: number;
  estado: string;
};

export function ClientesPage() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/clientes', {}, token).then((data) => setClientes(data.clientes));
  }, [token]);

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Alumnos</h2>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr>
            <th className="text-left py-2">Nombre</th>
            <th className="text-left py-2">Tickets</th>
            <th className="text-left py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">
                <Link to={`/admin/clientes/${c.id}`} className="hover:text-[var(--gold)]">
                  {c.nombre}
                </Link>
              </td>
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

Add the route to `src/App.tsx`: `<Route path="clientes" element={<ClientesPage />} />` inside the `/admin` route.

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/src/ClientesPage.test.tsx`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add api/_lib/estadoCuenta.ts api/admin/clientes/ src/components/EstadoBadge.tsx src/pages/ClientesPage.tsx src/App.tsx tests/
git commit -m "feat: clientes list with computed estado de cuenta"
```

---

### Task 5: Modalidades (Planes) — CRUD

**Files:**
- Create: `api/admin/modalidades/index.ts`, `src/pages/ModalidadesPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/modalidades.test.ts`, `tests/src/ModalidadesPage.test.tsx`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`requireRol` (Task 3).
- Produces: `GET /api/admin/modalidades` → `{ modalidades: Array<{ id, nombre, tipo, conZapas, cantTickets, precio, activo }> }`; `POST` creates one; `PATCH /api/admin/modalidades?id=` toggles `activo` or updates `precio`. Task 6 (Venta de Pase) reads this same list to populate its selector.

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
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'modalidades-test@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.modalidad.deleteMany({ where: { nombre: 'Pase x6' } });
    await prisma.admin.delete({ where: { email: 'modalidades-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('creates a new modalidad and lists it', async () => {
    const createRes = mockRes();
    await handler(
      {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { nombre: 'Pase x6', tipo: 'LIBRE', conZapas: false, cantTickets: 6, precio: 24000 },
      } as any,
      createRes
    );
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
import { ModalidadesPage } from '../../src/pages/ModalidadesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ModalidadesPage', () => {
  it('toggles activo when the switch is clicked', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation((path) => {
      if (path === '/api/admin/modalidades') {
        return Promise.resolve({
          modalidades: [{ id: '1', nombre: 'Pase x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000, activo: true }],
        });
      }
      return Promise.resolve({ modalidad: {} });
    });

    render(<ModalidadesPage />);
    await waitFor(() => expect(screen.getByText('Pase x4')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() =>
      expect(apiClient.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/modalidades?id=1'),
        expect.objectContaining({ method: 'PATCH' }),
        undefined
      )
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

type Modalidad = {
  id: string;
  nombre: string;
  tipo: string;
  conZapas: boolean;
  cantTickets: number;
  precio: number;
  activo: boolean;
};

export function ModalidadesPage() {
  const { token } = useAuth();
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/modalidades', {}, token).then((data) => setModalidades(data.modalidades));
  }, [token]);

  async function toggleActivo(m: Modalidad) {
    await apiFetch(`/api/admin/modalidades?id=${m.id}`, { method: 'PATCH', body: JSON.stringify({ activo: !m.activo }) }, token);
    setModalidades((prev) => prev.map((x) => (x.id === m.id ? { ...x, activo: !x.activo } : x)));
  }

  return (
    <div>
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Planes</h2>
      <table className="w-full text-sm">
        <thead className="text-[var(--rock-dim)] uppercase text-xs">
          <tr>
            <th className="text-left py-2">Nombre</th>
            <th className="text-left py-2">Tipo</th>
            <th className="text-left py-2">Zapas</th>
            <th className="text-left py-2">Tickets</th>
            <th className="text-left py-2">Precio</th>
            <th className="text-left py-2">Activo</th>
          </tr>
        </thead>
        <tbody>
          {modalidades.map((m) => (
            <tr key={m.id} className="border-t border-[var(--ink-line)]">
              <td className="py-3">{m.nombre}</td>
              <td className="py-3">{m.tipo}</td>
              <td className="py-3">{m.conZapas ? 'Con zapas' : 'Sin zapas'}</td>
              <td className="py-3 font-mono tabular-nums">{m.cantTickets}</td>
              <td className="py-3 font-mono tabular-nums">${m.precio}</td>
              <td className="py-3">
                <input type="checkbox" checked={m.activo} onChange={() => toggleActivo(m)} />
              </td>
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

### Task 6: Venta de pase — Compra + Tickets + Pago (el corazón de la cuenta corriente)

**Files:**
- Create: `api/admin/compras/index.ts`, `src/pages/VentaPasePage.tsx`
- Modify: `src/App.tsx`, `src/pages/ClientesPage.tsx` (add "Vender pase" link)
- Test: `tests/api/compras.test.ts`

**Interfaces:**
- Consumes: `Modalidad` (Task 5), `Cliente` (Task 4), `prisma`, `requireAuth`/`requireRol`.
- Produces: `POST /api/admin/compras` body `{ clienteId, modalidadId, medio, descuentoAplicado }` → creates one `Compra` with `cantTickets` `Ticket` rows (`DISPONIBLE`) and one `Pago`, sets `vencimiento` to 60 days from now, and writes one `Activity` row (`accion: 'venta_pase'`). Returns `{ compra }`. Task 7 (Ficha) reads the resulting `Compra`/`Ticket`/`Pago` rows.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/compras.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/compras/index';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/compras', () => {
  let adminToken: string;
  let clienteId: string;
  let modalidadId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'compras-test@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Compra Test', email: 'compras-test-cliente@realization.com' },
    });
    clienteId = cliente.id;
    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Compra Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 },
    });
    modalidadId = modalidad.id;
  });

  afterAll(async () => {
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.delete({ where: { id: modalidadId } });
    await prisma.admin.delete({ where: { email: 'compras-test@realization.com' } });
    await prisma.activity.deleteMany({ where: { accion: 'venta_pase' } });
    await prisma.$disconnect();
  });

  it('creates a compra with 4 tickets disponibles, a pago with descuento, and an activity log', async () => {
    const req: any = {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { clienteId, modalidadId, medio: 'EFECTIVO', descuentoAplicado: 10 },
    };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const compra = res.json.mock.calls[0][0].compra;

    const tickets = await prisma.ticket.findMany({ where: { compraId: compra.id } });
    expect(tickets).toHaveLength(4);
    expect(tickets.every((t) => t.estado === 'DISPONIBLE')).toBe(true);

    const pago = await prisma.pago.findUnique({ where: { compraId: compra.id } });
    expect(pago?.medio).toBe('EFECTIVO');
    expect(Number(pago?.descuentoAplicado)).toBe(10);

    const activity = await prisma.activity.findFirst({ where: { accion: 'venta_pase', actorId: admin.id } });
    expect(activity).not.toBeNull();
  });
});
```

Note: the `admin.id` reference in the last assertion needs the `admin` variable in scope — declare it in `beforeAll` (`const admin = ...`) instead of a local const, matching the pattern used in the other test files in this plan.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/compras.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/compras/index'"

- [ ] **Step 3: Implement the venta de pase endpoint**

```typescript
// api/admin/compras/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../_lib/prisma';
import { requireAuth, requireRol } from '../../_lib/auth';

const DIAS_VENCIMIENTO = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { clienteId, modalidadId, medio, descuentoAplicado } = req.body as {
    clienteId: string;
    modalidadId: string;
    medio: 'MERCADOPAGO' | 'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO';
    descuentoAplicado?: number;
  };

  const modalidad = await prisma.modalidad.findUnique({ where: { id: modalidadId } });
  if (!modalidad) {
    res.status(404).json({ error: 'La modalidad no existe.' });
    return;
  }

  const vencimiento = new Date();
  vencimiento.setDate(vencimiento.getDate() + DIAS_VENCIMIENTO);
  const descuento = descuentoAplicado ?? 0;
  const montoFinal = Number(modalidad.precio) * (1 - descuento / 100);

  const compra = await prisma.compra.create({
    data: {
      clienteId,
      modalidadId,
      vencimiento,
      precioPagado: montoFinal,
      tickets: { create: Array.from({ length: modalidad.cantTickets }, () => ({ estado: 'DISPONIBLE' as const })) },
      pago: {
        create: { clienteId, monto: montoFinal, medio, descuentoAplicado: descuento },
      },
    },
    include: { tickets: true, pago: true },
  });

  await prisma.activity.create({
    data: {
      actorId: payload.id,
      actorRol: 'ADMIN',
      accion: 'venta_pase',
      detalle: { clienteId, modalidadId, compraId: compra.id, medio, descuento },
    },
  });

  res.status(201).json({ compra });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/compras.test.ts`
Expected: PASS

- [ ] **Step 5: Build the VentaPasePage frontend (manual verification, no dedicated unit test — it composes ClientesPage/ModalidadesPage data already covered)**

```typescript
// src/pages/VentaPasePage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

export function VentaPasePage() {
  const { clienteId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [modalidadId, setModalidadId] = useState('');
  const [medio, setMedio] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState(0);

  useEffect(() => {
    apiFetch('/api/admin/modalidades', {}, token).then((data) =>
      setModalidades(data.modalidades.filter((m: any) => m.activo))
    );
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch(
      '/api/admin/compras',
      { method: 'POST', body: JSON.stringify({ clienteId, modalidadId, medio, descuentoAplicado: descuento }) },
      token
    );
    navigate(`/admin/clientes/${clienteId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <h2 className="font-['Anton'] uppercase text-2xl mb-6">Vender pase</h2>
      <select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)} className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2">
        <option value="">Elegí un plan</option>
        {modalidades.map((m) => (
          <option key={m.id} value={m.id}>{m.nombre} — ${m.precio}</option>
        ))}
      </select>
      <select value={medio} onChange={(e) => setMedio(e.target.value)} className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2">
        <option value="EFECTIVO">Efectivo</option>
        <option value="TRANSFERENCIA">Transferencia</option>
        <option value="TARJETA">Tarjeta</option>
        <option value="MERCADOPAGO">Mercado Pago</option>
      </select>
      <input
        type="number"
        placeholder="Descuento %"
        value={descuento}
        onChange={(e) => setDescuento(Number(e.target.value))}
        className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2"
      />
      <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3">
        Registrar venta
      </button>
    </form>
  );
}
```

Add the route: `<Route path="clientes/:clienteId/vender" element={<VentaPasePage />} />`. Add a "Vender pase" link per row in `ClientesPage.tsx` pointing to `/admin/clientes/${c.id}/vender`.

- [ ] **Step 6: Commit**

```bash
git add api/admin/compras/ src/pages/VentaPasePage.tsx src/App.tsx src/pages/ClientesPage.tsx tests/
git commit -m "feat: venta de pase (compra + tickets + pago) — cuenta corriente transaction"
```

---

### Task 7: Ficha de Cliente — vista única con todo el historial

**Files:**
- Create: `api/admin/clientes/[id].ts`, `src/pages/FichaClientePage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/fichaCliente.test.ts`, `tests/src/FichaClientePage.test.tsx`

**Interfaces:**
- Consumes: `calcularEstadoCuenta` (Task 4), all models from Task 2, `requireAuth`/`requireRol` (Task 3).
- Produces: `GET /api/admin/clientes/:id` → `{ cliente: { id, nombre, email, telefono, estado, ticketsDisponibles, vencimiento }, compras: [...], pagos: [...], reservas: [...] }`. Nothing later depends on this beyond the page itself.

- [ ] **Step 1: Write the failing test**

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
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'ficha-test@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Ficha Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Ficha Test Cliente', email: 'ficha-test-cliente@realization.com' },
    });
    clienteId = cliente.id;
    await prisma.compra.create({
      data: {
        clienteId,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 30 * 86400000),
        precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }, { estado: 'CONSUMIDO' }, { estado: 'CONSUMIDO' }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } },
      },
    });
  });

  afterAll(async () => {
    await prisma.pago.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { compra: { clienteId } } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Ficha Test x4' } });
    await prisma.admin.delete({ where: { email: 'ficha-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('returns cliente, compras, and pagos with computed estado', async () => {
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { id: clienteId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.cliente.ticketsDisponibles).toBe(2);
    expect(body.cliente.estado).toBe('por_vencer');
    expect(body.compras).toHaveLength(1);
    expect(body.pagos).toHaveLength(1);
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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { id } = req.query as { id: string };

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      compras: { include: { tickets: true, modalidad: true }, orderBy: { fechaCompra: 'desc' } },
      pagos: { orderBy: { createdAt: 'desc' } },
      reservas: { orderBy: { fechaHora: 'desc' }, take: 20 },
    },
  });

  if (!cliente) {
    res.status(404).json({ error: 'No encontramos ese alumno.' });
    return;
  }

  const ultimaCompra = cliente.compras[0] ?? null;
  const ticketsDisponibles = ultimaCompra
    ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length
    : 0;

  res.status(200).json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      ticketsDisponibles,
      vencimiento: ultimaCompra?.vencimiento ?? null,
      estado: calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null),
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

- [ ] **Step 5: Write the failing test for FichaClientePage**

```typescript
// tests/src/FichaClientePage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { FichaClientePage } from '../../src/pages/FichaClientePage';
import * as apiClient from '../../src/lib/apiClient';

describe('FichaClientePage', () => {
  it('renders cliente name, estado, and each compra/pago row', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      cliente: { id: '1', nombre: 'María González', ticketsDisponibles: 2, estado: 'por_vencer', vencimiento: null },
      compras: [{ id: 'c1', modalidad: { nombre: 'Pase x4' }, fechaCompra: new Date().toISOString(), precioPagado: 18000 }],
      pagos: [{ id: 'p1', medio: 'EFECTIVO', monto: 18000, descuentoAplicado: 10, createdAt: new Date().toISOString() }],
      reservas: [],
    });

    render(
      <MemoryRouter initialEntries={['/admin/clientes/1']}>
        <Routes>
          <Route path="/admin/clientes/:id" element={<FichaClientePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('María González')).toBeInTheDocument());
    expect(screen.getByText('Pase x4')).toBeInTheDocument();
    expect(screen.getByText(/EFECTIVO/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/src/FichaClientePage.test.tsx`
Expected: FAIL with "Cannot find module '../../src/pages/FichaClientePage'"

- [ ] **Step 7: Implement FichaClientePage**

```typescript
// src/pages/FichaClientePage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';
import { EstadoBadge } from '../components/EstadoBadge';

export function FichaClientePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch(`/api/admin/clientes/${id}`, {}, token).then(setData);
  }, [id, token]);

  if (!data) return <p>Cargando…</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">{data.cliente.nombre}</h2>
        <EstadoBadge estado={data.cliente.estado} />
      </div>

      <p className="font-mono tabular-nums text-3xl mb-8">{data.cliente.ticketsDisponibles} tickets</p>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Compras</h3>
      <ul className="mb-8">
        {data.compras.map((c: any) => (
          <li key={c.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{c.modalidad.nombre}</span>
            <span className="font-mono tabular-nums">${c.precioPagado}</span>
          </li>
        ))}
      </ul>

      <h3 className="uppercase text-xs text-[var(--rock-dim)] mb-3">Pagos</h3>
      <ul>
        {data.pagos.map((p: any) => (
          <li key={p.id} className="flex justify-between border-t border-[var(--ink-line)] py-2 text-sm">
            <span>{p.medio} — {Number(p.descuentoAplicado)}% desc.</span>
            <span className="font-mono tabular-nums">${p.monto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Add the route: `<Route path="clientes/:id" element={<FichaClientePage />} />`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/src/FichaClientePage.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add api/admin/clientes/\[id\].ts src/pages/FichaClientePage.tsx src/App.tsx tests/
git commit -m "feat: ficha de cliente con historial completo de compras y pagos"
```

---

### Task 8: Reservas + check-in manual (override)

**Files:**
- Create: `api/admin/reservas/index.ts`, `api/admin/reservas/[id]/checkin.ts`, `src/pages/ReservasPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/api/reservas.test.ts`, `tests/api/checkinManual.test.ts`

**Interfaces:**
- Consumes: `Reserva`, `Ticket`, `CheckIn`, `Activity` models (Task 2), `requireAuth`/`requireRol` (Task 3).
- Produces: `GET /api/admin/reservas?fecha=YYYY-MM-DD` → `{ reservas: [...] }`. `POST /api/admin/reservas/:id/checkin` marks `reserva.asistio = true`, the linked `ticket.estado = 'CONSUMIDO'`, creates a `CheckIn` row with `metodo: 'MANUAL'`, and an `Activity` row (`accion: 'checkin_manual'`). Task 9 (Dashboard) reads today's `CheckIn` rows produced here.

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
  hoy.setHours(19, 0, 0, 0);

  beforeAll(async () => {
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'reservas-test@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Reserva Test', email: 'reservas-test-cliente@realization.com' },
    });
    clienteId = cliente.id;
    await prisma.reserva.create({
      data: { clienteId, fechaHora: hoy, tipoClase: 'Boulder intermedio' },
    });
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.admin.delete({ where: { email: 'reservas-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('lists reservas for the given date', async () => {
    const fecha = hoy.toISOString().slice(0, 10);
    const req: any = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { fecha } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.reservas.some((r: any) => r.clienteId === clienteId)).toBe(true);
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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { fecha } = req.query as { fecha: string };
  const inicio = new Date(`${fecha}T00:00:00.000Z`);
  const fin = new Date(`${fecha}T23:59:59.999Z`);

  const reservas = await prisma.reserva.findMany({
    where: { fechaHora: { gte: inicio, lte: fin } },
    include: { cliente: true, checkIn: true },
    orderBy: { fechaHora: 'asc' },
  });

  res.status(200).json({ reservas });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/reservas.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the manual check-in override**

```typescript
// tests/api/checkinManual.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../api/_lib/prisma';
import { signToken } from '../../api/_lib/auth';
import handler from '../../api/admin/reservas/[id]/checkin';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/admin/reservas/:id/checkin', () => {
  let adminId: string;
  let adminToken: string;
  let clienteId: string;
  let reservaId: string;
  let ticketId: string;

  beforeAll(async () => {
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'checkin-test@realization.com', passwordHash: 'x' },
    });
    adminId = admin.id;
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });
    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Checkin Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Checkin Test', email: 'checkin-test-cliente@realization.com' },
    });
    clienteId = cliente.id;
    const compra = await prisma.compra.create({
      data: {
        clienteId,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 30 * 86400000),
        precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] },
      },
      include: { tickets: true },
    });
    ticketId = compra.tickets[0].id;
    const reserva = await prisma.reserva.create({
      data: { clienteId, ticketId, fechaHora: new Date(), tipoClase: 'Boulder' },
    });
    reservaId = reserva.id;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { clienteId } });
    await prisma.reserva.deleteMany({ where: { clienteId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.compra.deleteMany({ where: { clienteId } });
    await prisma.cliente.delete({ where: { id: clienteId } });
    await prisma.modalidad.deleteMany({ where: { nombre: 'Checkin Test x4' } });
    await prisma.activity.deleteMany({ where: { accion: 'checkin_manual' } });
    await prisma.admin.delete({ where: { email: 'checkin-test@realization.com' } });
    await prisma.$disconnect();
  });

  it('marks asistio true, consumes the ticket, and logs the override', async () => {
    const req: any = { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, query: { id: reservaId } };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
    expect(reserva?.asistio).toBe(true);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.estado).toBe('CONSUMIDO');

    const checkIn = await prisma.checkIn.findUnique({ where: { reservaId } });
    expect(checkIn?.metodo).toBe('MANUAL');

    const activity = await prisma.activity.findFirst({ where: { accion: 'checkin_manual', actorId: adminId } });
    expect(activity).not.toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/api/checkinManual.test.ts`
Expected: FAIL with "Cannot find module '../../api/admin/reservas/[id]/checkin'"

- [ ] **Step 7: Implement the override endpoint**

```typescript
// api/admin/reservas/[id]/checkin.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../_lib/prisma';
import { requireAuth, requireRol } from '../../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { id } = req.query as { id: string };

  const reserva = await prisma.reserva.findUnique({ where: { id } });
  if (!reserva) {
    res.status(404).json({ error: 'No encontramos esa reserva.' });
    return;
  }

  await prisma.reserva.update({ where: { id }, data: { asistio: true } });

  if (reserva.ticketId) {
    await prisma.ticket.update({ where: { id: reserva.ticketId }, data: { estado: 'CONSUMIDO', consumidoAt: new Date() } });
  }

  await prisma.checkIn.create({
    data: { clienteId: reserva.clienteId, reservaId: reserva.id, metodo: 'MANUAL' },
  });

  await prisma.activity.create({
    data: {
      actorId: payload.id,
      actorRol: 'ADMIN',
      accion: 'checkin_manual',
      detalle: { reservaId: reserva.id, clienteId: reserva.clienteId },
    },
  });

  res.status(200).json({ ok: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/api/checkinManual.test.ts`
Expected: PASS

- [ ] **Step 9: Implement ReservasPage (frontend, manual verification)**

```typescript
// src/pages/ReservasPage.tsx
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../lib/AuthContext';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ReservasPage() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(hoyISO());
  const [reservas, setReservas] = useState<any[]>([]);

  async function cargar() {
    const data = await apiFetch(`/api/admin/reservas?fecha=${fecha}`, {}, token);
    setReservas(data.reservas);
  }

  useEffect(() => { cargar(); }, [fecha, token]);

  async function marcarAsistencia(reservaId: string) {
    await apiFetch(`/api/admin/reservas/${reservaId}/checkin`, { method: 'POST' }, token);
    cargar();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-['Anton'] uppercase text-2xl">Reservas</h2>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-transparent border border-[var(--ink-line)] px-3 py-2" />
      </div>
      <ul>
        {reservas.map((r) => (
          <li key={r.id} className="flex items-center justify-between border-t border-[var(--ink-line)] py-3 text-sm">
            <span>{new Date(r.fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — {r.cliente.nombre} — {r.tipoClase}</span>
            {r.asistio ? (
              <span className="text-[var(--good)] font-mono text-xs uppercase">Asistió</span>
            ) : (
              <button onClick={() => marcarAsistencia(r.id)} className="border border-[var(--gold)] text-[var(--gold)] text-xs uppercase px-3 py-1">
                Marcar asistencia
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Add the route: `<Route path="reservas" element={<ReservasPage />} />`.

- [ ] **Step 10: Commit**

```bash
git add api/admin/reservas/ src/pages/ReservasPage.tsx src/App.tsx tests/
git commit -m "feat: reservas list and manual check-in override"
```

---

### Task 9: Dashboard "Hoy" — el tablero gráfico con mucho dato

**Files:**
- Create: `api/admin/dashboard/hoy.ts`, `src/components/StatTile.tsx`, `src/components/IngresosSparkline.tsx`, `src/pages/DashboardHoyPage.tsx`
- Modify: `src/App.tsx` (replace the `index` placeholder route with `DashboardHoyPage`)
- Test: `tests/api/dashboardHoy.test.ts`, `tests/src/DashboardHoyPage.test.tsx`

**Interfaces:**
- Consumes: `CheckIn`, `Reserva`, `Pago`, `Cliente`, `Compra`, `Ticket` (Task 2), `calcularEstadoCuenta` (Task 4).
- Produces: `GET /api/admin/dashboard/hoy` → `{ checkInsHoy: number, reservasHoy: number, cobrosHoyTotal: number, cobrosHoyPorMedio: Record<string, number>, alumnosAlerta: Array<{ id, nombre, estado, ticketsDisponibles }>, ingresosUltimos7Dias: Array<{ fecha: string, total: number }>, checkInsRecientes: Array<{ clienteNombre, timestamp }> }`. This is the last task in this plan — nothing downstream depends on it.

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
    const admin = await prisma.admin.create({
      data: { nombre: 'Test', email: 'dashboard-test@realization.com', passwordHash: 'x' },
    });
    adminToken = signToken({ id: admin.id, rol: 'ADMIN' });

    const modalidad = await prisma.modalidad.create({
      data: { nombre: 'Dashboard Test x4', tipo: 'LIBRE', conZapas: false, cantTickets: 4, precio: 18000 },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Dashboard Test Cliente', email: 'dashboard-test-cliente@realization.com' },
    });
    clienteId = cliente.id;

    const compra = await prisma.compra.create({
      data: {
        clienteId,
        modalidadId: modalidad.id,
        vencimiento: new Date(Date.now() + 30 * 86400000),
        precioPagado: 18000,
        tickets: { create: [{ estado: 'DISPONIBLE' }] },
        pago: { create: { clienteId, monto: 18000, medio: 'EFECTIVO' } },
      },
      include: { tickets: true },
    });
    compraId = compra.id;

    await prisma.checkIn.create({ data: { clienteId, metodo: 'MANUAL' } });
    await prisma.reserva.create({ data: { clienteId, fechaHora: new Date(), tipoClase: 'Boulder' } });
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

  it('aggregates checkins, reservas, cobros, alertas, and a 7-day ingresos series', async () => {
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

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (!requireRol(payload, 'ADMIN', res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const hoyInicio = inicioDelDia(new Date());
  const hoyFin = new Date(hoyInicio.getTime() + 86400000);

  const [checkInsHoy, reservasHoy, pagosHoy, clientes, checkInsRecientes] = await Promise.all([
    prisma.checkIn.count({ where: { timestamp: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.reserva.count({ where: { fechaHora: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.pago.findMany({ where: { createdAt: { gte: hoyInicio, lt: hoyFin } } }),
    prisma.cliente.findMany({
      include: { compras: { include: { tickets: true }, orderBy: { fechaCompra: 'desc' }, take: 1 } },
    }),
    prisma.checkIn.findMany({
      where: { timestamp: { gte: hoyInicio, lt: hoyFin } },
      include: { cliente: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
    }),
  ]);

  const cobrosHoyTotal = pagosHoy.reduce((sum, p) => sum + Number(p.monto), 0);
  const cobrosHoyPorMedio: Record<string, number> = {};
  for (const p of pagosHoy) {
    cobrosHoyPorMedio[p.medio] = (cobrosHoyPorMedio[p.medio] ?? 0) + Number(p.monto);
  }

  const alumnosAlerta = clientes
    .map((c) => {
      const ultimaCompra = c.compras[0] ?? null;
      const ticketsDisponibles = ultimaCompra ? ultimaCompra.tickets.filter((t) => t.estado === 'DISPONIBLE').length : 0;
      const estado = calcularEstadoCuenta(ticketsDisponibles, ultimaCompra?.vencimiento ?? null);
      return { id: c.id, nombre: c.nombre, estado, ticketsDisponibles };
    })
    .filter((c) => c.estado !== 'activo');

  const ingresosUltimos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const dia = new Date(hoyInicio.getTime() - i * 86400000);
    const diaFin = new Date(dia.getTime() + 86400000);
    const pagosDia = await prisma.pago.findMany({ where: { createdAt: { gte: dia, lt: diaFin } } });
    ingresosUltimos7Dias.push({
      fecha: dia.toISOString().slice(0, 10),
      total: pagosDia.reduce((sum, p) => sum + Number(p.monto), 0),
    });
  }

  res.status(200).json({
    checkInsHoy,
    reservasHoy,
    cobrosHoyTotal,
    cobrosHoyPorMedio,
    alumnosAlerta,
    ingresosUltimos7Dias,
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
import { DashboardHoyPage } from '../../src/pages/DashboardHoyPage';
import * as apiClient from '../../src/lib/apiClient';

describe('DashboardHoyPage', () => {
  it('renders the stat tiles and the alertas table', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      checkInsHoy: 5,
      reservasHoy: 8,
      cobrosHoyTotal: 54000,
      cobrosHoyPorMedio: { EFECTIVO: 36000, TRANSFERENCIA: 18000 },
      alumnosAlerta: [{ id: '1', nombre: 'Julián R.', estado: 'por_vencer', ticketsDisponibles: 2 }],
      ingresosUltimos7Dias: Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-08-${16 + i}`, total: 10000 * i })),
      checkInsRecientes: [{ clienteNombre: 'María G.', timestamp: new Date().toISOString() }],
    });

    render(<DashboardHoyPage />);

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/54.000|54000/)).toBeInTheDocument();
    expect(screen.getByText('Julián R.')).toBeInTheDocument();
    expect(screen.getByText('María G.')).toBeInTheDocument();
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
            <div
              className="w-full bg-[var(--gold)]"
              style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? '4px' : '1px' }}
              title={`$${d.total}`}
            />
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

  useEffect(() => {
    apiFetch('/api/admin/dashboard/hoy', {}, token).then(setData);
  }, [token]);

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
                <span className="font-mono tabular-nums text-[var(--rock)]">
                  {new Date(c.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border border-[var(--ink-line)]">
        <p className="text-xs uppercase text-[var(--rock)] p-4 border-b border-[var(--ink-line)]">Alumnos que necesitan atención</p>
        <table className="w-full text-sm">
          <tbody>
            {data.alumnosAlerta.map((a: any) => (
              <tr key={a.id} className="border-t border-[var(--ink-line)]">
                <td className="p-4">
                  <Link to={`/admin/clientes/${a.id}`} className="hover:text-[var(--gold)]">{a.nombre}</Link>
                </td>
                <td className="p-4 font-mono tabular-nums">{a.ticketsDisponibles} tickets</td>
                <td className="p-4"><EstadoBadge estado={a.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
git commit -m "feat: dashboard Hoy — stat tiles, sparkline de ingresos, y alertas de cuenta corriente"
```

---

### Task 10: Deploy and smoke-check on Vercel

**Files:**
- Modify: `index.html` (already Vite's own — remove the old static brand-book copy at repo root if it still shadows the app)
- No new test — this task's "test" is the live smoke check below.

- [ ] **Step 1: Confirm the old static landing doesn't collide with the Vite build**

Run: `ls index.html` — this must be the Vite entry from Task 1, not the brand-book copy. If the brand book is still there, move it back to `shared/brand/brand-manual.html` only (already the canonical copy) and delete the root duplicate.

```bash
git rm index.html
git checkout HEAD~9 -- index.html 2>/dev/null || true
```

If that doesn't cleanly restore the Vite `index.html` from Task 1, re-create it directly from Task 1 Step 8's content instead of relying on git history gymnastics.

- [ ] **Step 2: Set environment variables in Vercel**

```bash
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
```

Paste the Neon pooled connection string and a long random secret when prompted.

- [ ] **Step 3: Push to main and let auto-deploy build**

```bash
git push
```

Run: `vercel inspect --logs $(vercel ls realization-pass-control --meta | head -1)` if the build fails, to read the error.

- [ ] **Step 4: Run the seed against production once, manually**

Run: `DATABASE_URL="<same pooled URL>" npx tsx prisma/seed.ts`
Expected: prints no error; creates the Dani admin login for production use.

- [ ] **Step 5: Smoke-check the live site**

Visit `https://realization-pass-control.vercel.app/login`, log in with `dani@realization.com` / `realization2026`, and confirm: Hoy dashboard loads with real numbers, Alumnos lists María, clicking her opens the ficha, Reservas shows today's date picker, Planes lists the seeded modalidades.

- [ ] **Step 6: Commit the cleanup if Step 1 required changes**

```bash
git add index.html
git commit -m "chore: remove brand-book placeholder now that the real admin app is live"
git push
```

---

## Self-Review Notes

- **Spec coverage:** ficha + cuenta corriente (Tasks 4, 6, 7), graphic data-dense Hoy dashboard (Task 9), admin-first sequencing (this whole plan precedes the Client plan), brand constraints (Global Constraints + every frontend task uses the token CSS vars, sharp corners, no icons), Ticket-as-entity and Plan/Modalidad decoupling (Task 2 schema), Activity audit log (Tasks 6 and 8 write to it), override manual check-in (Task 8), Mercado Pago and QR/GPS explicitly deferred (Global Constraints).
- **Placeholder scan:** every step has runnable code and exact commands; no "TBD"/"similar to Task N" shortcuts.
- **Type consistency:** `EstadoCuenta` values (`'activo' | 'por_vencer' | 'vencido'`) are identical across Task 4, 7, and 9. `TokenPayload` (`{ id, rol }`) is identical across Task 3 and every route that calls `requireAuth`/`requireRol`. `apiFetch(path, options, token)` signature is identical in every frontend page.

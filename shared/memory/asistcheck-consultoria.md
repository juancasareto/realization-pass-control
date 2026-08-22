# Consultoría técnica — AsistCheck

> Dos respuestas por email del equipo Core de AsistCheck, en respuesta a la consulta enviada
> desde Realization Pass Control sobre control de acceso por celular. Guardado como referencia
> técnica para todo el equipo (Matías, Santiago, Lucía, Gonzalo, Valentín).

## Aclaración conceptual clave

Lo que Realization construye **no es control de asistencia**, es un **registro de consumo de
tickets contra cuenta corriente**. En AsistCheck el check-in produce el dato principal (¿vino a
trabajar?). En Realization el check-in **consume un recurso ya comprado**. El corazón del sistema
son las cuentas corrientes y los cobros; el check-in es la interfaz de consumo.

## 1. Check-in desde el teléfono (100% replicable)

- **QR por sucursal**: cartel impreso con QR **estático** (no rotativo, simplifica operación).
  El usuario escanea con `html5-qrcode` (API directa `Html5Qrcode`, cámara trasera) y el frontend
  manda `{qrCodeId, lat, lng}` al backend.
- **GPS puro sin QR**: fallback automático si falla la cámara; también sirve como método primario
  si el QR se despega o el celular no tiene cámara.
- **Validación siempre en el backend**, nunca confiar en el frontend: distancia al centro
  configurado (`radioCercaMetros`, ellos usan 100m default). Fuera de radio → HTTP 422 con la
  distancia real. **Nunca revelar el radio** configurado, para evitar que lo hackeen.
- En Realization, un check-in válido debe **descontar el ticket en la misma transacción**.
- Extras: device fingerprinting (FingerprintJS free tier + fallback UUID en localStorage) para
  detectar dispositivo nuevo y notificar al admin; geocoding con Nominatim (OSM, gratis, sin API
  key) para alta de sucursal sin coordenadas manuales.

## 2. ¿Integrar con AsistCheck? No.

AsistCheck es SaaS multi-tenant de asistencia **laboral** (contratos, turnos con tolerancia,
ausencias justificadas, licencias, feriados, horas trabajadas). No tiene concepto de "cliente que
compró tickets" ni "cuenta corriente consumible" — el 80% del negocio de Realization.

Su modelo (`Empresa → Sucursal → Empleado → EventoAsistencia`) no matchea con el de Realization
(`Cliente → Plan → CuentaCorriente → Ticket → CheckIn → Cobro`). El esfuerzo de adaptar sería mayor
que construir desde cero. **Lo reusable es el patrón arquitectónico y los gotchas**, no el código
ni una integración de API.

## 3. Stack recomendado

| Capa | Elección |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS v4 |
| Backend | Express + TypeScript → Vercel Serverless Functions |
| DB | Neon Postgres (integración nativa Vercel, free tier generoso) |
| ORM | Prisma v7 |
| Auth | JWT (365d) + Google OAuth opcional |
| QR scanner | html5-qrcode v2.3.8 |
| Geocoding | Nominatim (OSM, gratis) |
| Pagos | Mercado Pago SDK |
| Emails | Resend |
| Deploy | GitHub → Vercel auto-deploy |

Costo inicial: $0/mes hasta cierto volumen; al escalar, ~$25/mes.

## Modelo de datos propuesto

```
Cliente         (id, nombre, email, telefono, deviceToken, rol='CLIENTE')
Admin           (id, nombre, email, rol='ADMIN')  // Dani + otros
Plan            (id, nombre, tipo: 'CLASES'|'LIBRE', conZapas, cantTickets, precio)
Compra          (clienteId, planId, fechaCompra, vencimiento, precioPagado)
Ticket          (compraId, estado: 'DISPONIBLE'|'CONSUMIDO'|'PENALIZADO', consumidoAt)
Reserva         (clienteId, ticketId, fechaHora, tipoClase, asistio, aviso24hs)
CheckIn         (clienteId, reservaId, timestamp, lat, lng, metodo: 'QR'|'GPS'|'MANUAL')
Pago            (clienteId, compraId, monto, medio: 'MP'|'TARJETA'|'TRANSF'|'EFECTIVO',
                 descuentoAplicado, mpReferenceId)
```

- **Ticket como entidad propia** (no contador en Plan) → trazabilidad por unidad y auditoría de
  consumos raros.
- **Regla 24hs**: cron diario a las 23:59 marca `asistio=true` en reservas del día sin CheckIn
  asociado y llama a `consumirTicket()`. El mismo cron manda mail avisando el descuento.
- **Descuento efectivo**: guardar `descuentoAplicado` en el pago (no hardcodear) para trazabilidad
  y reportes.

## 4. Roles y permisos — CLIENTE vs ADMIN

- JWT firmado con `{id, rol}`; middlewares `requireAuth` + `requireRol('ADMIN')` en rutas
  sensibles; frontend con `ProtectedRoute` + `AuthContext`.
- **Páginas físicamente separadas por rol** (`ClientePage.tsx` / `AdminPage.tsx`), no ocultar
  botones con CSS. Login único (`POST /api/auth/login`), redirect según `user.rol`.
  - Menos bugs de fuga de datos por diseño (no por CSS).
  - Bundles más chicos por rol.
  - Mobile-first para cliente sin comprometer desktop-first del admin.

### App CLIENTE (mobile-first)

Pantalla principal = **"mi saldo, siempre visible"**: tickets restantes + vencimiento del plan.
Todo lo demás es secundario. Una sola pantalla scrolleable, cero menús laterales/tabs.

- Número grande de tickets restantes + barra de progreso con color por saldo (verde >50%,
  amber 20-50% "sugiere renovar", rojo <20% "renovar plan").
- Notificación/banner cuando quedan ≤2 clases o el plan vence en ≤7 días (momento de renovación).
- Botón "Fichar" **contextual**: activo solo si el GPS detecta cercanía al muro; fuera de radio,
  deshabilitado con leyenda "Acercate al muro para fichar" (igual loguea el intento en backend).
- Historial de check-ins con delta visible (`–1 ticket`) para trazabilidad ante reclamos.
- PWA instalable (banner nativo en Android Chrome; instrucciones manuales en iOS — Compartir →
  Agregar a inicio).

### App ADMIN (Dani, desktop-first responsive)

Panel operativo, estilo dashboard de restaurante:

- **Dashboard "Hoy"** (landing): alumnos que ya ficharon, reservas pendientes, cobros pendientes,
  alertas de saldo bajo, lista en vivo de check-ins, cobros del día (caja).
- **Alumnos**: CRUD + búsqueda + filtro por estado de cuenta (con saldo/sin saldo/vencido), ficha
  con historial de compras, tickets, asistencias y pagos.
- **Reservas**: calendario semanal, ver anotados por clase, marcar asistencia manual (override
  GPS), cancelar reservas.
- **Cobros**: registrar cobro manual (efectivo/transferencia/tarjeta) con selector de descuento,
  ver pagos MP, conciliar.
- **Planes**: gestión de los 8 planes (Libre/Clases × con-zapas/sin-zapas × 4 modalidades).
- **Reportes**: ingresos por mes, planes más vendidos, alumnos activos vs. churn, no-shows
  penalizados.
- **Override manual de check-in es crítico**: Dani tiene que poder marcar asistencia por un alumno
  con 1 click (batería descargada, sin señal, olvido). Resolución en 5 segundos.
- Rol futuro (no urgente): **PROFESOR** — read-only de reservas del día + marcar asistencia solo
  de su clase.

## 5. Gotchas (para evitar noches perdidas)

**GPS**
- `enableHighAccuracy: true` + `maximumAge: 0` obligatorio (sin esto Chrome cachea ubicaciones
  viejas de horas).
- Android tiene modo "aproximada" (error 500m-2km) vs "precisa" — armar pantalla explicando cómo
  activarla (los usuarios no lo descubren solos).
- GPS impreciso en interiores (20-200m incluso en modo preciso) → considerar radio 150-200m si el
  muro está en local cerrado.

**Vercel Serverless**
- La lambda se corta al llamar `res.json()`. Cualquier email/webhook/notificación debe llevar
  `await` antes de responder. **Nunca** `.catch(() => {})` sin await — oculta el error.
- Timeout 10s en plan hobby, 60s en pro. Diseñar endpoints livianos.

**Timezone / fechas**
- Postgres `TIMESTAMP` sin timezone + dev local UTC-3 + Neon en UTC → configurar
  `types.setTypeParser(1114, val => new Date(val + 'Z'))` en scripts o todo se corre 3 horas.
- Para reservas de "todo el día", guardar timestamp a las 12:00 UTC (no 00:00) para evitar que el
  día se corra en UTC-3.

**PWA / iOS**
- iOS Safari en modo PWA (agregado a home) tiene permisos distintos al browser normal — modales
  explicando permisos según iOS/Android/PWA son indispensables.
- Banner "instalar app" solo funciona en Android Chrome nativo; en iOS, instrucciones manuales.

**Falsos check-ins (más crítico para Realization que para AsistCheck)**
- QR estático pegado en la pared se puede fotografiar y compartir → impacta plata directamente
  (alguien ficha por otro para no perder ticket). Opciones:
  1. Foto del cliente al check-in (guardar hash/thumbnail, no la foto entera, por privacidad).
  2. QR rotativo con TOTP cada 30s en tablet de mostrador (infalsificable, más operación).
  3. Confiar + auditar solo ante reclamo (probablemente suficiente para volumen de gimnasio
     boutique).
- **Sugerencia de arranque**: opción 3 + device fingerprinting, auditar recién ante la primera
  queja.

**Conectividad**: señal mala en el muro rompe el check-in → considerar WiFi del local y el
override manual del admin como fallback. Offline queue con sync posterior: complejo, no
recomendado para MVP.

**Batería descargada**: el override manual del admin es la única solución realista.

## Recomendación práctica de arranque (prioridad por valor, no por lo "sexy")

1. **CRM + Cliente** (auth + saldo visible) — el cliente puede loguearse y ver su saldo desde
   el día 1, aunque el check-in todavía no exista.
2. **Planes + Compras + Cobros** (MP + registro manual) — sin cobros no hay negocio.
3. **Reservas + regla 24hs** — es donde está la plata.
4. **Panel Admin** (Dashboard "Hoy" + Alumnos + override manual) — Dani deja de anotar en papel.
5. **Check-in por celular** (QR + GPS) — la parte "sexy", puede convivir con control manual de
   Dani las primeras semanas.
6. **Reportes / analytics**.

> El check-in por celular es ~20% del trabajo y ~20% del ROI en el corto plazo. La app del
> cliente puede lanzarse en beta mostrando solo el saldo, y agregar el check-in después.

AsistCheck ofreció además mostrar de cerca cómo tienen armados los roles y la app del empleado,
como referencia para la app del cliente de Realization — queda abierto para retomar si hace falta.

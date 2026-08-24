import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLayoutEffect, useRef, useState } from 'react';
import { MiPerfilModal } from './MiPerfilModal';

const NAV = [
  { to: '/admin', label: 'Hoy', end: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { to: '/admin/clientes', label: 'Alumnos', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/admin/reservas', label: 'Reservas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/admin/horarios', label: 'Horarios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/admin/cobros', label: 'Cobros', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/admin/modalidades', label: 'Planes', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
];

const SECTION_TITLES: Record<string, string> = {
  '/admin': 'Hoy',
  '/admin/clientes': 'Alumnos',
  '/admin/reservas': 'Reservas',
  '/admin/horarios': 'Horarios',
  '/admin/calendario': 'Calendario',
  '/admin/cobros': 'Cobros',
  '/admin/modalidades': 'Planes',
};

const ROL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESOR: 'Profesor',
};

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="square" strokeLinejoin="miter" d={d} />
    </svg>
  );
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getSectionTitle(pathname: string): string {
  if (SECTION_TITLES[pathname]) return SECTION_TITLES[pathname];
  if (pathname.startsWith('/admin/clientes/')) {
    return pathname.includes('/vender') ? 'Venta de pase' : 'Ficha de alumno';
  }
  return 'Panel';
}

export function AdminLayout() {
  const { nombre, email, rol, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!navRef.current || !pillRef.current) return;
    const active = navRef.current.querySelector<HTMLAnchorElement>('a.nav-active');
    if (active) {
      pillRef.current.style.top = `${active.offsetTop}px`;
      pillRef.current.style.height = `${active.offsetHeight}px`;
      pillRef.current.style.opacity = '1';
    } else {
      pillRef.current.style.opacity = '0';
    }
  }, [location.pathname]);

  const sectionTitle = getSectionTitle(location.pathname);
  const initials = getInitials(nombre);
  const rolLabel = rol ? (ROL_LABEL[rol] ?? rol) : '';

  const sidebarContent = (
    <aside className="w-64 h-full flex flex-col bg-[var(--ink-raised)] border-r border-[var(--ink-line)]">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[color:rgb(255_255_255/0.06)] flex items-center gap-3">
        <img src="/logo.jpeg" alt="Realization" className="h-12 w-12 rounded-full object-cover" />
        <div>
          <span className="font-['Anton'] text-[var(--chalk)] uppercase text-sm tracking-wide block leading-tight">Realization</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--rock-dim)] block">Admin</span>
        </div>
      </div>

      {/* User identity */}
      <div className="px-4 py-4 border-b border-[color:rgb(255_255_255/0.06)]">
        <button
          onClick={() => { setPerfilOpen(true); setMobileOpen(false); }}
          className="flex items-center gap-3 bg-[rgb(255_255_255/0.04)] hover:bg-[rgb(255_255_255/0.07)] p-3 w-full text-left transition-colors rounded-md"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--gold)] text-[var(--ink)] flex items-center justify-center text-xs font-bold font-['JetBrains_Mono'] shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--chalk)] truncate leading-tight">{nombre}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--rock-dim)] mt-0.5">{rolLabel}</p>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--rock-dim)] px-3 mb-3 block">Navegación</span>
        <div ref={navRef} className="relative">
          <div
            ref={pillRef}
            className="absolute left-0 right-0 bg-[rgb(255_255_255/0.06)] transition-all duration-200 ease-out pointer-events-none opacity-0 rounded-md"
          />
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 text-sm uppercase tracking-wide transition-colors ${
                  isActive ? 'nav-active text-[var(--gold)]' : 'text-[var(--rock)] hover:text-[var(--chalk)]'
                }`
              }
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[color:rgb(255_255_255/0.06)]">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-[var(--rock-dim)] hover:text-[var(--chalk)] transition-colors uppercase tracking-wide"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="square" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-40">{sidebarContent}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>

      {/* Content area */}
      <div className="md:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-20 h-[60px] bg-[var(--ink)] border-b border-[var(--ink-line)] flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4 min-w-0">
            <button
              className="md:hidden text-[var(--rock)] hover:text-[var(--chalk)] shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="square" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-['Anton'] text-lg uppercase tracking-wide text-[var(--chalk)] truncate">{sectionTitle}</h1>
          </div>

          <button
            onClick={() => setPerfilOpen(true)}
            className="flex items-center gap-3 hover:bg-[rgb(255_255_255/0.04)] px-2 py-1 transition-colors min-w-0 rounded-md"
          >
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-sm text-[var(--chalk)] truncate leading-tight">{nombre}</p>
              <p className="text-[11px] text-[var(--rock)] truncate leading-tight">{email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--gold)] text-[var(--ink)] flex items-center justify-center text-xs font-bold font-['JetBrains_Mono'] shrink-0">
              {initials}
            </div>
          </button>
        </header>

        {/* Page content */}
        <main className="p-6 md:p-8"><Outlet /></main>
      </div>

      <MiPerfilModal open={perfilOpen} onClose={() => setPerfilOpen(false)} />
    </div>
  );
}

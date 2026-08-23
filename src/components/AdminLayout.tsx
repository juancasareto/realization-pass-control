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

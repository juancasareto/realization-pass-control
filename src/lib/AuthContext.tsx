import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from './apiClient';

type AuthState = {
  token: string | null;
  nombre: string | null;
  email: string | null;
  rol: string | null;
  login: (e: string, p: string) => Promise<void>;
  logout: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rpc_token'));
  const [nombre, setNombre] = useState<string | null>(() => localStorage.getItem('rpc_nombre'));
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem('rpc_email'));
  const [rol, setRol] = useState<string | null>(() => localStorage.getItem('rpc_rol'));

  async function login(emailArg: string, password: string) {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: emailArg, password }) });
    localStorage.setItem('rpc_token', data.token);
    localStorage.setItem('rpc_nombre', data.nombre);
    localStorage.setItem('rpc_email', data.email ?? emailArg);
    localStorage.setItem('rpc_rol', data.rol ?? 'ADMIN');
    setToken(data.token);
    setNombre(data.nombre);
    setEmail(data.email ?? emailArg);
    setRol(data.rol ?? 'ADMIN');
  }

  function logout() {
    localStorage.removeItem('rpc_token');
    localStorage.removeItem('rpc_nombre');
    localStorage.removeItem('rpc_email');
    localStorage.removeItem('rpc_rol');
    setToken(null);
    setNombre(null);
    setEmail(null);
    setRol(null);
  }

  return <AuthContext.Provider value={{ token, nombre, email, rol, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

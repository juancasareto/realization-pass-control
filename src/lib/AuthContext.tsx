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

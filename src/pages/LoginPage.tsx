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
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-[var(--ink-line)] p-8 rounded-md">
        <img src="/logo.jpeg" alt="Realization" className="h-20 w-20 rounded-full object-cover mx-auto mb-6" />
        {error && <p className="text-[var(--crit)] text-sm mb-4">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)] rounded-md" />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 bg-transparent border border-[var(--ink-line)] px-3 py-2 text-[var(--chalk)] rounded-md" />
        <button type="submit" className="w-full bg-[var(--gold)] text-[var(--ink)] font-bold py-3 rounded-md">Entrar</button>
      </form>
    </div>
  );
}

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

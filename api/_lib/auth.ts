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

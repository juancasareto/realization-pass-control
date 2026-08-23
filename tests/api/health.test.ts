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

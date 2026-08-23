import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { FichaClientePage } from '../../src/pages/FichaClientePage';
import * as apiClient from '../../src/lib/apiClient';

describe('FichaClientePage', () => {
  it('renders cliente name, stats, compras, pagos, and reservas con estado', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      cliente: {
        id: '1', nombre: 'María González', ticketsDisponibles: 2, estado: 'por_vencer', vencimiento: null,
        fotoUrl: null, clienteDesde: '2026-01-10T00:00:00.000Z', ausenciasSinAviso: 1, ultimaVisita: '2026-08-20T00:00:00.000Z',
      },
      compras: [{ id: 'c1', modalidad: { nombre: 'Pase x4' }, fechaCompra: new Date().toISOString(), precioPagado: 18000 }],
      pagos: [{ id: 'p1', medio: 'EFECTIVO', monto: 18000, descuentoAplicado: 10, createdAt: new Date().toISOString() }],
      reservas: [{ id: 'r1', fechaHora: new Date().toISOString(), tipoClase: 'Boulder', estadoAsistencia: 'PENALIZADA' }],
    });

    // FichaClientePage calls useAuth() (needs AuthProvider) and useParams() (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/clientes/1']}>
          <Routes><Route path="/admin/clientes/:id" element={<FichaClientePage />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('María González')).toBeInTheDocument());
    expect(screen.getByText('Pase x4')).toBeInTheDocument();
    expect(screen.getByText(/EFECTIVO/)).toBeInTheDocument();
    expect(screen.getByText('PENALIZADA')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // ausenciasSinAviso
  });
});

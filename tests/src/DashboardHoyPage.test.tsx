import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { DashboardHoyPage } from '../../src/pages/DashboardHoyPage';
import * as apiClient from '../../src/lib/apiClient';

describe('DashboardHoyPage', () => {
  it('renders stat tiles, alertas de saldo, y pendientes de recuperar', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      checkInsHoy: 5, reservasHoy: 8, cobrosHoyTotal: 54000,
      cobrosHoyPorMedio: { EFECTIVO: 36000, TRANSFERENCIA: 18000 },
      alumnosAlerta: [{ id: '1', nombre: 'Julián R.', estado: 'por_vencer', ticketsDisponibles: 2 }],
      pendientesDeRecuperar: [{ clienteId: '2', clienteNombre: 'Nico F.', fechaHora: new Date().toISOString(), diasRestantes: 4 }],
      ingresosUltimos7Dias: Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-08-${16 + i}`, total: 10000 * i })),
      checkInsRecientes: [{ clienteNombre: 'María G.', timestamp: new Date().toISOString() }],
    });

    // DashboardHoyPage calls useAuth() (needs AuthProvider) and renders <Link> (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter><DashboardHoyPage /></MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Julián R.')).toBeInTheDocument();
    expect(screen.getByText('Nico F.')).toBeInTheDocument();
    expect(screen.getByText(/4 días/)).toBeInTheDocument();
  });
});

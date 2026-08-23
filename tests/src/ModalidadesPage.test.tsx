import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ModalidadesPage } from '../../src/pages/ModalidadesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ModalidadesPage', () => {
  it('toggles activo when the switch is clicked', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation((path) => {
      if (path === '/api/admin/modalidades') {
        return Promise.resolve({ modalidades: [{ id: '1', nombre: 'Pase x4', tipo: 'CLASES', conZapas: false, cantTickets: 4, precio: 18000, activo: true }] });
      }
      return Promise.resolve({ modalidad: {} });
    });

    // ModalidadesPage calls useAuth() — needs AuthProvider or the render throws.
    render(<AuthProvider><ModalidadesPage /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Pase x4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox'));
    // AuthProvider's initial token is null (no rpc_token in jsdom's localStorage), not undefined.
    await waitFor(() =>
      expect(apiClient.apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/modalidades?id=1'), expect.objectContaining({ method: 'PATCH' }), null)
    );
  });
});

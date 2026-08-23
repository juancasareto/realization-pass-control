import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ClientesPage } from '../../src/pages/ClientesPage';
import * as apiClient from '../../src/lib/apiClient';

describe('ClientesPage', () => {
  it('renders rows with estado badges and re-fetches when the search box changes', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      clientes: [{ id: '1', nombre: 'María', email: 'm@x.com', ticketsDisponibles: 8, vencimiento: null, estado: 'activo' }],
    });

    // ClientesPage calls useAuth() (needs AuthProvider) and renders <Link> (needs a Router) —
    // both wrappers are required or the render throws before any assertion runs.
    render(
      <AuthProvider>
        <MemoryRouter><ClientesPage /></MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('María')).toBeInTheDocument());
    // Check for the badge specifically (it's in a span)
    expect(screen.getByRole('cell', { name: /Activo/ })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email'), { target: { value: 'mar' } });
    // AuthProvider's initial token is null (no rpc_token in jsdom's localStorage), not undefined.
    await waitFor(() => expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('q=mar'), {}, null));
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../src/lib/AuthContext';
import { HorariosPage } from '../../src/pages/HorariosPage';
import * as apiClient from '../../src/lib/apiClient';

describe('HorariosPage', () => {
  it('loads and displays horarios with profesor names resolved', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation((path) => {
      if (path === '/api/admin/horarios') {
        return Promise.resolve({ horarios: [{ id: '1', diaSemana: 4, hora: '20:00', tipoClase: 'Boulder avanzado', cupoMaximo: 40, profesorId: 'prof1', profesorNombre: 'Marcos', activo: true }] });
      }
      if (path === '/api/admin/profesores') {
        return Promise.resolve({ profesores: [{ id: 'prof1', nombre: 'Marcos', activo: true }] });
      }
      return Promise.resolve({});
    });

    render(<AuthProvider><HorariosPage /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Boulder avanzado')).toBeInTheDocument());
    const cells = screen.getAllByText('Marcos');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { LoginPage } from '../../src/pages/LoginPage';

describe('App', () => {
  it('renders the Realization logo in the shell', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.getByAltText(/Realization/i)).toBeInTheDocument();
  });
});

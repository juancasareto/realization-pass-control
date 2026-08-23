import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/AuthContext';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no token', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login screen</div>} />
            <Route path="/admin" element={<ProtectedRoute><div>Secret</div></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
});

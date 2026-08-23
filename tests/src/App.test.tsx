import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('App', () => {
  it('renders Realization in the shell', () => {
    render(<App />);
    expect(screen.getByText(/Realization/i)).toBeInTheDocument();
  });
});

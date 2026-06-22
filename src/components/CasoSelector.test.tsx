import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CasoSelector from './CasoSelector';

describe('CasoSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filtered case options', () => {
    const casos = ['viajenet', 'hogarnet', 'resetnet'];
    render(<CasoSelector casos={casos} selected="" onSelect={mockOnSelect} />);

    expect(screen.getByText('Netflix - Estoy de viaje')).toBeTruthy();
    expect(screen.getByText('Netflix - Código Hogar')).toBeTruthy();
    expect(screen.getByText('Netflix - Cambiar contraseña')).toBeTruthy();
    expect(screen.queryByText('Win - Código')).toBeNull();
  });

  it('renders all case options when all cases passed', () => {
    const casos = ['viajenet', 'hogarnet', 'resetnet', 'ininet', 'wincode', 'cgptcode', 'univer1', 'accmax'];
    render(<CasoSelector casos={casos} selected="" onSelect={mockOnSelect} />);

    expect(screen.getByText('Netflix - Estoy de viaje')).toBeTruthy();
    expect(screen.getByText('Win - Código')).toBeTruthy();
    expect(screen.getByText('Tools - ChatGPT Code')).toBeTruthy();
    expect(screen.getByText('Universal - código')).toBeTruthy();
    expect(screen.getByText('Max - código acceso')).toBeTruthy();
  });

  it('calls onSelect when a case is clicked', () => {
    const casos = ['viajenet', 'hogarnet'];
    render(<CasoSelector casos={casos} selected="" onSelect={mockOnSelect} />);

    const viajeBtn = screen.getByText('Netflix - Estoy de viaje');
    fireEvent.click(viajeBtn);

    expect(mockOnSelect).toHaveBeenCalledWith('viajenet');
  });

  it('highlights the selected case', () => {
    const casos = ['viajenet', 'hogarnet'];
    render(<CasoSelector casos={casos} selected="viajenet" onSelect={mockOnSelect} />);

    const buttons = screen.getAllByRole('button');
    const selectedBtn = buttons.find(b => b.textContent?.includes('Netflix - Estoy de viaje'));
    expect(selectedBtn?.className).toContain('border-[#ffc62a]');
  });

  it('renders nothing when casos array is empty', () => {
    const { container } = render(<CasoSelector casos={[]} selected="" onSelect={mockOnSelect} />);

    expect(container.querySelectorAll('button').length).toBe(0);
  });
});

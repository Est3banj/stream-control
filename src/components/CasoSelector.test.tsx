import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('calls onSelect when a case is selected', () => {
    const casos = ['viajenet', 'hogarnet'];
    render(<CasoSelector casos={casos} selected="" onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'viajenet' } });

    expect(mockOnSelect).toHaveBeenCalledWith('viajenet');
  });

  it('selects the active case value', () => {
    const casos = ['viajenet', 'hogarnet'];
    render(<CasoSelector casos={casos} selected="viajenet" onSelect={mockOnSelect} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('viajenet');
  });

  it('renders only default option when casos array is empty', () => {
    render(<CasoSelector casos={[]} selected="" onSelect={mockOnSelect} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe('Selecciona un caso');
  });
});

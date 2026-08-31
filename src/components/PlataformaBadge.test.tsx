import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlataformaBadge, { parsePlataformas } from './PlataformaBadge';

describe('PlataformaBadge', () => {
  describe('parsePlataformas', () => {
    it('handles single platform', () => {
      expect(parsePlataformas('Netflix')).toEqual(['Netflix']);
    });

    it('splits combos by + delimiter', () => {
      expect(parsePlataformas('Netflix + Disney+')).toEqual(['Netflix', 'Disney']);
    });

    it('splits combos by comma delimiter', () => {
      expect(parsePlataformas('Max, Prime Video, Spotify')).toEqual(['Max', 'Prime Video', 'Spotify']);
    });

    it('handles empty or undefined string', () => {
      expect(parsePlataformas('')).toEqual([]);
      expect(parsePlataformas(null as unknown as string)).toEqual([]);
    });
  });

  describe('Component rendering', () => {
    it('renders single platform with correct styles', () => {
      render(<PlataformaBadge plataforma="Netflix" />);
      const badge = screen.getByText('Netflix');
      expect(badge).toBeTruthy();
      expect(badge.className).toContain('text-red-400');
    });

    it('renders individual badges for combos', () => {
      render(<PlataformaBadge plataforma="Netflix + Spotify" />);
      const netflix = screen.getByText('Netflix');
      const spotify = screen.getByText('Spotify');
      expect(netflix).toBeTruthy();
      expect(spotify).toBeTruthy();
      expect(netflix.className).toContain('text-red-400');
      expect(spotify.className).toContain('text-emerald-400');
    });

    it('renders fallback for empty platform', () => {
      render(<PlataformaBadge plataforma="" />);
      expect(screen.getByText('—')).toBeTruthy();
    });

    it('renders default style for unknown platform', () => {
      render(<PlataformaBadge plataforma="ServicioDesconocido" />);
      const badge = screen.getByText('ServicioDesconocido');
      expect(badge.className).toContain('text-slate-300');
    });
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketingSuiteModal from './MarketingSuiteModal';
import * as apiClient from '../../lib/apiClient';

vi.mock('../../hooks/useAdminConfig', () => ({
  useAdminConfig: () => ({ config: { whatsapp: '573247349128' }, loading: false }),
  sanitizarWhatsApp: (num: string) => num.replace(/[^0-9]/g, ''),
  getWhatsAppSupportNumber: () => '573247349128',
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('MarketingSuiteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields, categories, channels, audience options, and CTA presets', () => {
    render(<MarketingSuiteModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Marketing & Comunicación Masiva')).toBeInTheDocument();
    expect(screen.getByText('📢 Comunicado')).toBeInTheDocument();
    expect(screen.getByText('🔥 Promoción')).toBeInTheDocument();
    expect(screen.getByText('⏰ Vencimiento')).toBeInTheDocument();
    expect(screen.getByText('🚀 Novedad')).toBeInTheDocument();

    // Inputs
    expect(screen.getByPlaceholderText(/50% de Descuento/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escribí el contenido/i)).toBeInTheDocument();

    // Channels
    expect(screen.getByText('Campanita In-App')).toBeInTheDocument();
    expect(screen.getByText('Banner Superior')).toBeInTheDocument();
    expect(screen.getByText('Correo Masivo')).toBeInTheDocument();

    // Audience
    expect(screen.getByText('Todos los usuarios')).toBeInTheDocument();
    expect(screen.getByText('Solo con suscripción activa')).toBeInTheDocument();
    expect(screen.getByText('Por vencer (≤ 7 días)')).toBeInTheDocument();
  });

  it('applies CTA presets (WhatsApp, Renovar, Promo)', () => {
    render(<MarketingSuiteModal isOpen={true} onClose={vi.fn()} />);

    const whatsappPresetBtn = screen.getByRole('button', { name: /whatsapp/i });
    fireEvent.click(whatsappPresetBtn);

    const buttonTextInput = screen.getByPlaceholderText(/Texto \(Ej: Renovar mi Plan/i);
    const linkInput = screen.getByPlaceholderText(/URL o enlace WhatsApp/i);

    expect(buttonTextInput).toHaveValue('Hablar con Soporte');
    expect((linkInput as HTMLInputElement).value).toContain('https://wa.me/573247349128');
  });

  it('switches to Live Preview tab and toggles between in-app and email preview', () => {
    render(<MarketingSuiteModal isOpen={true} onClose={vi.fn()} />);

    const previewTab = screen.getByRole('button', { name: /vista previa/i });
    fireEvent.click(previewTab);

    expect(screen.getByText('Dropdown de Notificaciones (In-App)')).toBeInTheDocument();

    const emailPreviewBtn = screen.getByRole('button', { name: /correo dark saas/i });
    fireEvent.click(emailPreviewBtn);

    expect(screen.getByText('Plantilla Resend Responsive Dark SaaS')).toBeInTheDocument();
  });

  it('dispatches campaign calling enviarComunicadoMasivo API and triggers success callback', async () => {
    const callFunctionSpy = vi.spyOn(apiClient, 'callFunction').mockResolvedValue({
      success: true,
      totalDestinatarios: 15,
      enviados: 15,
      fallidos: 0,
    });

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(<MarketingSuiteModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/50% de Descuento/i), {
      target: { value: 'Gran Descuento 50%' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Escribí el contenido/i), {
      target: { value: 'Aprovechá la oferta especial durante 48 horas.' },
    });

    // Select category '🔥 Promoción'
    fireEvent.click(screen.getByText('🔥 Promoción'));

    // Check email channel
    const emailCheckbox = screen.getByLabelText(/correo masivo/i);
    fireEvent.click(emailCheckbox);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /publicar & difundir/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callFunctionSpy).toHaveBeenCalledWith('enviarComunicadoMasivo', expect.objectContaining({
        titulo: 'Gran Descuento 50%',
        mensaje: 'Aprovechá la oferta especial durante 48 horas.',
        tipo: 'promocion',
        canales: expect.objectContaining({ inApp: true, email: true }),
      }));
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

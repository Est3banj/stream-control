import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEmailVerificationWatcher } from './useEmailVerificationWatcher';

const mockRefreshUser = vi.fn();
const mockUser = { uid: 'usr-123', email: 'test@streamcontrol.com', nombre: 'Test User' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
    user: mockUser,
  }),
}));

describe('useEmailVerificationWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('polls periodically and calls onVerified when refreshUser returns true', async () => {
    const onVerified = vi.fn();
    mockRefreshUser.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 2000,
        onVerified,
        enabled: true,
      })
    );

    // Initial state: not called yet
    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();

    // Advance 2s (first poll -> false)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    // Advance 2s (second poll -> true)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(2);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('triggers check on window focus event with debounce', async () => {
    const onVerified = vi.fn();
    mockRefreshUser.mockResolvedValue(false);

    renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 5000,
        onVerified,
        enabled: true,
      })
    );

    // Trigger focus event
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // Advance debounce time (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it('triggers check on document visibilitychange event when visible', async () => {
    const onVerified = vi.fn();
    mockRefreshUser.mockResolvedValue(false);

    renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 5000,
        onVerified,
        enabled: true,
      })
    );

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it('does not poll or register listeners when enabled is false', async () => {
    const onVerified = vi.fn();
    mockRefreshUser.mockResolvedValue(true);

    renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 2000,
        onVerified,
        enabled: false,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(mockRefreshUser).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('handles refreshUser errors silently without throwing', async () => {
    const onVerified = vi.fn();
    mockRefreshUser.mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 2000,
        onVerified,
        enabled: true,
      })
    );

    let status = true;
    await act(async () => {
      status = await result.current.checkStatus();
    });

    expect(status).toBe(false);
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('cleans up interval and listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useEmailVerificationWatcher({
        pollingIntervalMs: 2000,
        onVerified: vi.fn(),
        enabled: true,
      })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

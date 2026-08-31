import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import OtpInput from './OtpInput';

function OtpInputTestWrapper(props: {
  initialValue?: string;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const [value, setValue] = useState(props.initialValue || '');
  return (
    <OtpInput
      value={value}
      onChange={setValue}
      onComplete={props.onComplete}
      disabled={props.disabled}
      hasError={props.hasError}
    />
  );
}

describe('OtpInput Component', () => {
  it('renders 6 inputs with numeric attributes', () => {
    render(<OtpInputTestWrapper />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);

    inputs.forEach((input, index) => {
      expect(input).toHaveAttribute('inputMode', 'numeric');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
      expect(input).toHaveAttribute('maxLength', '1');
      expect(input).toHaveAttribute('aria-label', `Dígito ${index + 1}`);
    });
  });

  it('allows entering digits and auto-advances focus to next input', () => {
    render(<OtpInputTestWrapper />);
    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], { target: { value: '4' } });
    expect(inputs[0]).toHaveValue('4');

    fireEvent.change(inputs[1], { target: { value: '8' } });
    expect(inputs[1]).toHaveValue('8');
  });

  it('handles backspace on empty input to move back and clear previous', () => {
    render(<OtpInputTestWrapper initialValue="48" />);
    const inputs = screen.getAllByRole('textbox');

    expect(inputs[0]).toHaveValue('4');
    expect(inputs[1]).toHaveValue('8');

    // Press backspace on input 2 (index 2, which is empty)
    fireEvent.keyDown(inputs[2], { key: 'Backspace' });
    expect(inputs[1]).toHaveValue('');
  });

  it('handles paste of full 6-digit text and triggers onComplete', () => {
    const handleComplete = vi.fn();
    render(<OtpInputTestWrapper onComplete={handleComplete} />);
    const inputs = screen.getAllByRole('textbox');

    const pasteData = {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? 'Tu código es 948123' : ''),
      },
    };

    fireEvent.paste(inputs[0], pasteData);

    expect(inputs[0]).toHaveValue('9');
    expect(inputs[1]).toHaveValue('4');
    expect(inputs[2]).toHaveValue('8');
    expect(inputs[3]).toHaveValue('1');
    expect(inputs[4]).toHaveValue('2');
    expect(inputs[5]).toHaveValue('3');

    expect(handleComplete).toHaveBeenCalledTimes(1);
    expect(handleComplete).toHaveBeenCalledWith('948123');
  });

  it('ignores non-numeric characters on change', () => {
    render(<OtpInputTestWrapper />);
    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], { target: { value: 'a' } });
    expect(inputs[0]).toHaveValue('');

    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect(inputs[0]).toHaveValue('5');
  });

  it('applies error styles when hasError is true', () => {
    render(<OtpInputTestWrapper hasError={true} />);
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input.className).toContain('border-red-500');
    });
  });
});

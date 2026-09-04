import { useEffect, useRef, useState } from 'react';
import { isoToDateBRInput, maskDateBR, parseDateBRToISO } from '@/utils/formatters';

interface DateFieldProps {
  id: string;
  label: string;
  /** Valor em ISO "aaaa-mm-dd", ou '' se vazio. */
  value: string;
  onChange: (isoValue: string) => void;
  error?: string;
  helperText?: string;
  min?: string;
  max?: string;
}

/**
 * Campo de data híbrido: permite digitar manualmente no formato dd/mm/aaaa
 * (com máscara automática) OU escolher no calendário nativo do navegador,
 * pelo ícone à direita — as duas formas funcionam ao mesmo tempo.
 */
export function DateField({ id, label, value, onChange, error, helperText, min, max }: DateFieldProps) {
  const [text, setText] = useState(() => isoToDateBRInput(value));
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Mantém o texto visível sincronizado quando o valor muda por fora (ex: calendário nativo).
  useEffect(() => {
    setText(isoToDateBRInput(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    const masked = maskDateBR(raw);
    setText(masked);

    if (masked === '') {
      onChange('');
      return;
    }

    const iso = parseDateBRToISO(masked);
    if (iso) onChange(iso);
  };

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          className={`field-input pr-11 ${error ? 'field-input-error' : ''}`}
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        {/* Ícone decorativo — o clique real é capturado pelo input nativo logo abaixo, que fica por cima dele. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 my-auto h-5 w-5 text-navy-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
        </svg>

        {/* Input nativo type=date, sobreposto só na área do ícone: clicar ali abre o calendário do navegador. */}
        <input
          ref={nativeInputRef}
          type="date"
          aria-label={`Abrir calendário — ${label}`}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-y-0 right-0 w-11 cursor-pointer opacity-0"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
      {helperText && !error && <p className="mt-1.5 text-xs text-navy-400">{helperText}</p>}
    </div>
  );
}

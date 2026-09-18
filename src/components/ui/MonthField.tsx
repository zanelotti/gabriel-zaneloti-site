import { useEffect, useRef, useState } from 'react';
import { isoToMonthBRInput, maskMonthBR, parseMonthBRToISO } from '@/utils/formatters';

interface MonthFieldProps {
  id: string;
  label: string;
  /** Valor em ISO "aaaa-mm-dd" (o dia é sempre 01, sem significado), ou '' se vazio. */
  value: string;
  onChange: (isoValue: string) => void;
  error?: string;
  helperText?: string;
  min?: string;
  max?: string;
}

/**
 * Campo de mês/ano híbrido (só coleta mês e ano, sem dia — a obra é
 * localizada no tempo pela competência, não por um dia específico): permite
 * digitar manualmente no formato mm/aaaa (com máscara automática) OU escolher
 * no seletor nativo do navegador, pelo ícone à direita.
 */
export function MonthField({ id, label, value, onChange, error, helperText, min, max }: MonthFieldProps) {
  const [text, setText] = useState(() => isoToMonthBRInput(value));
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Mantém o texto visível sincronizado quando o valor muda por fora (ex: seletor nativo).
  useEffect(() => {
    setText(isoToMonthBRInput(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    const masked = maskMonthBR(raw);
    setText(masked);

    if (masked === '') {
      onChange('');
      return;
    }

    const iso = parseMonthBRToISO(masked);
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
          placeholder="mm/aaaa"
          maxLength={7}
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

        {/* Input nativo type=month, sobreposto só na área do ícone: clicar ali abre o seletor do navegador. */}
        <input
          ref={nativeInputRef}
          type="month"
          aria-label={`Abrir seletor de mês — ${label}`}
          value={value ? value.slice(0, 7) : ''}
          min={min ? min.slice(0, 7) : undefined}
          max={max ? max.slice(0, 7) : undefined}
          onChange={(event) => onChange(event.target.value ? `${event.target.value}-01` : '')}
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

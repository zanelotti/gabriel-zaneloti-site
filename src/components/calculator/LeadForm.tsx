import type { CalculatorData, FormErrors } from '@/types/calculator';
import { maskWhatsApp } from '@/utils/formatters';
import { CalculatorStep } from './CalculatorStep';

interface LeadFormProps {
  data: Pick<CalculatorData, 'nome' | 'whatsapp'>;
  errors: FormErrors<CalculatorData>;
  onChange: <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => void;
}

/** Etapa 1 da calculadora — dados básicos de contato do lead. */
export function LeadForm({ data, errors, onChange }: LeadFormProps) {
  return (
    <CalculatorStep title="Vamos começar" description="Precisamos apenas do seu nome e WhatsApp para continuar.">
      <div>
        <label htmlFor="nome" className="field-label">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          autoComplete="name"
          className={`field-input ${errors.nome ? 'field-input-error' : ''}`}
          placeholder="Seu nome completo"
          value={data.nome}
          onChange={(event) => onChange('nome', event.target.value)}
          aria-invalid={Boolean(errors.nome)}
          aria-describedby={errors.nome ? 'nome-error' : undefined}
        />
        {errors.nome && (
          <p id="nome-error" className="field-error">
            {errors.nome}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="whatsapp" className="field-label">
          WhatsApp com DDD
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className={`field-input ${errors.whatsapp ? 'field-input-error' : ''}`}
          placeholder="(21) 98521-3949"
          value={data.whatsapp}
          onChange={(event) => onChange('whatsapp', maskWhatsApp(event.target.value))}
          aria-invalid={Boolean(errors.whatsapp)}
          aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined}
        />
        {errors.whatsapp && (
          <p id="whatsapp-error" className="field-error">
            {errors.whatsapp}
          </p>
        )}
      </div>
    </CalculatorStep>
  );
}

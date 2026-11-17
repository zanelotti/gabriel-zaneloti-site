import type { CalculatorData, FormErrors } from '@/types/calculator';
import { maskWhatsApp } from '@/utils/formatters';
import { CalculatorStep } from './CalculatorStep';

interface LeadFormProps {
  data: Pick<CalculatorData, 'nome' | 'whatsapp' | 'aceitaTermos'>;
  errors: FormErrors<CalculatorData>;
  onChange: <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => void;
}

/** Última etapa da calculadora — para onde enviar a análise (contato + aceite da Política de Privacidade). */
export function LeadForm({ data, errors, onChange }: LeadFormProps) {
  return (
    <CalculatorStep
      title="Para onde enviamos a sua análise?"
      description="Último passo. A análise da sua obra chega no seu WhatsApp em até 24 horas."
    >
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
      <p className="text-xs leading-relaxed text-navy-400">
        Seus dados serão usados só para enviar a sua análise e falar sobre a sua obra. Não enviamos propaganda.
      </p>

      <div>
        <label className="flex items-start gap-3 text-sm text-navy-600">
          <input
            id="aceitaTermos"
            name="aceitaTermos"
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-navy-300 text-accent-500 focus:ring-accent-400"
            checked={data.aceitaTermos}
            onChange={(event) => onChange('aceitaTermos', event.target.checked)}
            aria-invalid={Boolean(errors.aceitaTermos)}
            aria-describedby={errors.aceitaTermos ? 'aceitaTermos-error' : undefined}
          />
          <span>
            Li e concordo com a{' '}
            <a
              href="/privacidade.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-navy-700 underline hover:text-accent-600"
            >
              Política de Privacidade
            </a>{' '}
            e autorizo o contato pelo WhatsApp sobre a minha obra.
          </span>
        </label>
        {errors.aceitaTermos && (
          <p id="aceitaTermos-error" className="field-error">
            {errors.aceitaTermos}
          </p>
        )}
      </div>
    </CalculatorStep>
  );
}

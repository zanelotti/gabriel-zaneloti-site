import type { CalculatorData, FormErrors } from '@/types/calculator';
import { CalculatorStep } from './CalculatorStep';

interface AreasStepProps {
  data: Pick<CalculatorData, 'areaPrincipal' | 'areaPiscina' | 'observacoes'>;
  errors: FormErrors<CalculatorData>;
  onChange: <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => void;
}

function parseAreaInput(value: string): number | null {
  if (value.trim() === '') return null;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Etapa 3 da calculadora — áreas da construção e observações finais. */
export function AreasStep({ data, errors, onChange }: AreasStepProps) {
  return (
    <CalculatorStep
      title="Áreas e observações"
      description="Últimos detalhes para calcularmos sua estimativa."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="areaPrincipal" className="field-label">
            Área da construção principal (m²)
          </label>
          <input
            id="areaPrincipal"
            name="areaPrincipal"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={`field-input ${errors.areaPrincipal ? 'field-input-error' : ''}`}
            placeholder="Ex: 180"
            value={data.areaPrincipal ?? ''}
            onChange={(event) => onChange('areaPrincipal', parseAreaInput(event.target.value))}
            aria-invalid={Boolean(errors.areaPrincipal)}
            aria-describedby={errors.areaPrincipal ? 'areaPrincipal-error' : undefined}
          />
          {errors.areaPrincipal && (
            <p id="areaPrincipal-error" className="field-error">
              {errors.areaPrincipal}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="areaPiscina" className="field-label">
            Área da piscina (m²) <span className="font-normal text-navy-400">— opcional</span>
          </label>
          <input
            id="areaPiscina"
            name="areaPiscina"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={`field-input ${errors.areaPiscina ? 'field-input-error' : ''}`}
            placeholder="Ex: 20"
            value={data.areaPiscina ?? ''}
            onChange={(event) => onChange('areaPiscina', parseAreaInput(event.target.value))}
            aria-invalid={Boolean(errors.areaPiscina)}
            aria-describedby={errors.areaPiscina ? 'areaPiscina-error' : undefined}
          />
          {errors.areaPiscina && (
            <p id="areaPiscina-error" className="field-error">
              {errors.areaPiscina}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-navy-400">
        Considere a área da piscina apenas se ela já estiver incluída no projeto/execução da obra.
      </p>

      <div>
        <label htmlFor="observacoes" className="field-label">
          Observações <span className="font-normal text-navy-400">— opcional</span>
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={4}
          className="field-input resize-none"
          placeholder="Informe qualquer detalhe que possa ser relevante sobre sua obra."
          value={data.observacoes}
          onChange={(event) => onChange('observacoes', event.target.value)}
        />
      </div>

      <p className="text-xs leading-relaxed text-navy-400">
        Seus dados serão utilizados exclusivamente para entrar em contato sobre sua simulação e atendimento.
      </p>
    </CalculatorStep>
  );
}

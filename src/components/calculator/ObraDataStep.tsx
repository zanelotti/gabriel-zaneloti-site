import type {
  CalculatorData,
  CategoriaObra,
  Destinacao,
  FormErrors,
  Responsavel,
  SituacaoObra,
  TipoObra,
} from '@/types/calculator';
import { BRAZILIAN_STATES } from '@/data/states';
import { DateField } from '../ui/DateField';
import { CalculatorStep } from './CalculatorStep';

interface ObraDataStepProps {
  data: Pick<
    CalculatorData,
    'dataInicio' | 'dataFim' | 'responsavel' | 'tipoObra' | 'situacao' | 'categoria' | 'estado' | 'destinacao'
  >;
  errors: FormErrors<CalculatorData>;
  onChange: <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => void;
}

const TIPO_OBRA_OPTIONS: { value: TipoObra; label: string }[] = [
  { value: 'alvenaria', label: 'Alvenaria' },
  { value: 'madeira', label: 'Madeira' },
  { value: 'mista', label: 'Mista' },
];

const CATEGORIA_OPTIONS: { value: CategoriaObra; label: string }[] = [
  { value: 'obra_nova', label: 'Obra nova' },
  { value: 'acrescimo', label: 'Acréscimo' },
  { value: 'reforma', label: 'Reforma' },
  { value: 'demolicao', label: 'Demolição' },
];

const SITUACAO_OPTIONS: { value: SituacaoObra; label: string }[] = [
  { value: 'concluida_com_habite_se', label: 'Concluída com Habite-se' },
  { value: 'concluida_sem_habite_se', label: 'Concluída sem Habite-se' },
  { value: 'em_construcao', label: 'Em construção' },
  { value: 'iniciar_em_breve', label: 'Iniciar em breve' },
  { value: 'construida_ha_mais_de_5_anos', label: 'Construída há mais de 5 anos' },
];

const DESTINACAO_OPTIONS: { value: Destinacao; label: string }[] = [
  { value: 'residencial_unifamiliar', label: 'Residencial unifamiliar' },
  { value: 'multifamiliar', label: 'Multifamiliar' },
  { value: 'comercial_salas_lojas', label: 'Comercial — salas e lojas' },
  { value: 'galpao_industrial', label: 'Galpão industrial' },
  { value: 'conjunto_habitacional', label: 'Conjunto habitacional' },
  { value: 'edificio_garagem', label: 'Edifício garagem' },
];

const RESPONSAVEL_OPTIONS: { value: Responsavel; label: string; hint: string }[] = [
  { value: 'PF', label: 'Pessoa Física', hint: 'A obra está em nome de um CPF' },
  { value: 'PJ', label: 'Pessoa Jurídica', hint: 'A obra está em nome de um CNPJ' },
];

/** Etapa 2 da calculadora — dados da obra. */
export function ObraDataStep({ data, errors, onChange }: ObraDataStepProps) {
  return (
    <CalculatorStep title="Dados da obra" description="Conte um pouco mais sobre a sua construção.">
      <div className="grid gap-5 sm:grid-cols-2">
        <DateField
          id="dataInicio"
          label="Data de início da obra"
          value={data.dataInicio}
          onChange={(value) => onChange('dataInicio', value)}
          error={errors.dataInicio}
        />

        <DateField
          id="dataFim"
          label="Data de fim da obra"
          value={data.dataFim}
          onChange={(value) => onChange('dataFim', value)}
          error={errors.dataFim}
          helperText="Deixe em branco se a obra ainda está em andamento."
        />
      </div>

      <fieldset>
        <legend className="field-label">Responsável pela obra</legend>
        <div className="grid grid-cols-2 gap-3">
          {RESPONSAVEL_OPTIONS.map((option) => {
            const isSelected = data.responsavel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange('responsavel', option.value)}
                aria-pressed={isSelected}
                className={`rounded-xl2 border-2 p-4 text-left transition-all duration-150 ${
                  isSelected
                    ? 'border-accent-500 bg-accent-50 shadow-soft'
                    : 'border-navy-100 bg-white hover:border-navy-200'
                }`}
              >
                <span className={`block font-semibold ${isSelected ? 'text-accent-700' : 'text-navy-800'}`}>
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-navy-400">{option.hint}</span>
              </button>
            );
          })}
        </div>
        {errors.responsavel && <p className="field-error">{errors.responsavel}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tipoObra" className="field-label">
            Tipo de obra
          </label>
          <select
            id="tipoObra"
            name="tipoObra"
            className={`field-input ${errors.tipoObra ? 'field-input-error' : ''}`}
            value={data.tipoObra}
            onChange={(event) => onChange('tipoObra', event.target.value as TipoObra)}
            aria-invalid={Boolean(errors.tipoObra)}
          >
            <option value="">Selecione</option>
            {TIPO_OBRA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.tipoObra && <p className="field-error">{errors.tipoObra}</p>}
        </div>

        <div>
          <label htmlFor="situacao" className="field-label">
            Situação da obra
          </label>
          <select
            id="situacao"
            name="situacao"
            className={`field-input ${errors.situacao ? 'field-input-error' : ''}`}
            value={data.situacao}
            onChange={(event) => onChange('situacao', event.target.value as SituacaoObra)}
            aria-invalid={Boolean(errors.situacao)}
          >
            <option value="">Selecione</option>
            {SITUACAO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.situacao && <p className="field-error">{errors.situacao}</p>}
        </div>

        <div>
          <label htmlFor="categoria" className="field-label">
            Categoria da obra
          </label>
          <select
            id="categoria"
            name="categoria"
            className={`field-input ${errors.categoria ? 'field-input-error' : ''}`}
            value={data.categoria}
            onChange={(event) => onChange('categoria', event.target.value as CategoriaObra)}
            aria-invalid={Boolean(errors.categoria)}
          >
            <option value="">Selecione</option>
            {CATEGORIA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.categoria && <p className="field-error">{errors.categoria}</p>}
        </div>

        <div>
          <label htmlFor="estado" className="field-label">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            className={`field-input ${errors.estado ? 'field-input-error' : ''}`}
            value={data.estado}
            onChange={(event) => onChange('estado', event.target.value)}
            aria-invalid={Boolean(errors.estado)}
          >
            <option value="">Selecione</option>
            {BRAZILIAN_STATES.map((state) => (
              <option key={state.uf} value={state.uf}>
                {state.uf} — {state.nome}
              </option>
            ))}
          </select>
          {errors.estado && <p className="field-error">{errors.estado}</p>}
        </div>

        <div>
          <label htmlFor="destinacao" className="field-label">
            Destinação
          </label>
          <select
            id="destinacao"
            name="destinacao"
            className={`field-input ${errors.destinacao ? 'field-input-error' : ''}`}
            value={data.destinacao}
            onChange={(event) => onChange('destinacao', event.target.value as Destinacao)}
            aria-invalid={Boolean(errors.destinacao)}
          >
            <option value="">Selecione</option>
            {DESTINACAO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.destinacao && <p className="field-error">{errors.destinacao}</p>}
        </div>
      </div>
    </CalculatorStep>
  );
}

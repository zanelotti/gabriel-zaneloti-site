import { useState, type FormEvent } from 'react';
import type { FatorAjusteInput, ResponsavelObra } from '@/types/fatorAjuste';

interface CalculoFormProps {
  onSubmit: (input: FatorAjusteInput) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FormState {
  rmt100: string;
  areaM2: string;
  dataInicio: string;
  dataFim: string;
  responsavel: ResponsavelObra;
  dataCalculo: string;
  honorarios: string;
}

const INITIAL_STATE: FormState = {
  rmt100: '',
  areaM2: '',
  dataInicio: '',
  dataFim: '',
  responsavel: 'PF',
  dataCalculo: todayISO(),
  honorarios: '',
};

export function CalculoForm({ onSubmit }: CalculoFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState('');

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const rmt100 = Number(form.rmt100.replace(',', '.'));
    const areaM2 = Number(form.areaM2.replace(',', '.'));
    const honorarios = form.honorarios.trim() === '' ? null : Number(form.honorarios.replace(',', '.'));

    if (!rmt100 || rmt100 <= 0) return setError('Informe a RMT (100% SERO), maior que zero.');
    if (!areaM2 || areaM2 <= 0) return setError('Informe a área da obra, maior que zero.');
    if (!form.dataInicio) return setError('Informe a data de início da obra.');
    if (!form.dataFim) return setError('Informe a data de fim (competência final da DCTFWeb).');
    if (form.dataFim < form.dataInicio) return setError('A data de fim não pode ser anterior à data de início.');
    if (!form.dataCalculo) return setError('Informe a data de realização do cálculo.');

    onSubmit({
      rmt100,
      areaM2,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      responsavel: form.responsavel,
      dataCalculo: form.dataCalculo,
      honorarios,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="rmt100">
            RMT (100% SERO) — R$
          </label>
          <input
            id="rmt100"
            type="text"
            inputMode="decimal"
            className="field-input"
            placeholder="Ex: 34699,38"
            value={form.rmt100}
            onChange={(e) => update('rmt100', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="areaM2">
            Área da obra (m²)
          </label>
          <input
            id="areaM2"
            type="text"
            inputMode="decimal"
            className="field-input"
            placeholder="Ex: 241,87"
            value={form.areaM2}
            onChange={(e) => update('areaM2', e.target.value)}
          />
          <p className="mt-1.5 text-xs text-navy-400">≤350 m² → Fator de 50% · &gt;350 m² → Fator de 70%</p>
        </div>

        <div>
          <label className="field-label" htmlFor="dataInicio">
            Início da obra / 1ª competência DCTFWeb
          </label>
          <input
            id="dataInicio"
            type="date"
            className="field-input"
            value={form.dataInicio}
            onChange={(e) => update('dataInicio', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="dataFim">
            Fim da obra / última competência DCTFWeb
          </label>
          <input
            id="dataFim"
            type="date"
            className="field-input"
            value={form.dataFim}
            onChange={(e) => update('dataFim', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="dataCalculo">
            Data de realização do cálculo
          </label>
          <input
            id="dataCalculo"
            type="date"
            className="field-input"
            value={form.dataCalculo}
            onChange={(e) => update('dataCalculo', e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="responsavel">
            Responsável pela obra
          </label>
          <select
            id="responsavel"
            className="field-input"
            value={form.responsavel}
            onChange={(e) => update('responsavel', e.target.value as ResponsavelObra)}
          >
            <option value="PF">Pessoa Física (parcela mín. R$200)</option>
            <option value="PJ">Pessoa Jurídica (parcela mín. R$500)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="honorarios">
            Honorários (R$) <span className="font-normal text-navy-400">— opcional, definido manualmente</span>
          </label>
          <input
            id="honorarios"
            type="text"
            inputMode="decimal"
            className="field-input"
            placeholder="Deixe em branco se ainda não definiu"
            value={form.honorarios}
            onChange={(e) => update('honorarios', e.target.value)}
          />
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <button type="submit" className="btn-primary w-full sm:w-auto">
        Calcular
      </button>
    </form>
  );
}

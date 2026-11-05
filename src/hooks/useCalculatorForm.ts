import { useCallback, useState } from 'react';
import { INITIAL_CALCULATOR_DATA } from '@/types/calculator';
import type { CalculatorData, CalculatorStepIndex, FormErrors, INSSResult } from '@/types/calculator';
import { validateStep1, validateStep2, validateStep3 } from '@/utils/validation';
import { calculateINSS } from '@/services/calculateINSS';
import { leadService } from '@/services/leadService';
import { trackEvent } from '@/services/analytics';

interface UseCalculatorFormReturn {
  data: CalculatorData;
  step: CalculatorStepIndex;
  errors: FormErrors<CalculatorData>;
  /** true depois que os dados foram enviados (o visitante vê só a confirmação — o valor calculado NÃO é mostrado). */
  enviado: boolean;
  isSubmitting: boolean;
  updateField: <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => void;
  goNext: () => void;
  goBack: () => void;
  submit: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook central que concentra todo o estado da calculadora em um único objeto
 * (CalculatorData), evitando espalhar os dados entre múltiplos states soltos.
 */
export function useCalculatorForm(): UseCalculatorFormReturn {
  const [data, setData] = useState<CalculatorData>(INITIAL_CALCULATOR_DATA);
  const [step, setStep] = useState<CalculatorStepIndex>(1);
  const [errors, setErrors] = useState<FormErrors<CalculatorData>>({});
  const [enviado, setEnviado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [started, setStarted] = useState(false);

  const updateField = useCallback(
    <K extends keyof CalculatorData>(field: K, value: CalculatorData[K]) => {
      if (!started) {
        setStarted(true);
        trackEvent('calculator_started');
      }
      setData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [started]
  );

  const goNext = useCallback(() => {
    if (step === 1) {
      const stepErrors = validateStep1(data);
      setErrors(stepErrors);
      if (Object.keys(stepErrors).length > 0) return;
      trackEvent('calculator_step_1_completed');
      setStep(2);
      return;
    }

    if (step === 2) {
      const stepErrors = validateStep2(data);
      setErrors(stepErrors);
      if (Object.keys(stepErrors).length > 0) return;
      trackEvent('calculator_step_2_completed');
      setStep(3);
    }
  }, [step, data]);

  const goBack = useCallback(() => {
    setErrors({});
    setStep((prev) => (prev > 1 ? ((prev - 1) as CalculatorStepIndex) : prev));
  }, []);

  const submit = useCallback(async () => {
    const stepErrors = validateStep3(data);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;

    setIsSubmitting(true);
    // Cede o controle ao navegador por um instante antes do cálculo (síncrono e,
    // em geral, quase instantâneo) para garantir que o texto "Calculando..." do
    // botão apareça na tela antes de qualquer processamento — evita a sensação
    // de "travamento" em conexões/dispositivos mais lentos.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      let calcResult: INSSResult | null = null;
      try {
        // O cálculo continua sendo feito (o CRM e o bot usam esses números),
        // mas o valor NÃO é mostrado ao visitante.
        calcResult = calculateINSS(data);
      } catch {
        // Datas fora da faixa suportada ou combinação de dados que o motor não sabe tratar —
        // não trava a captura do lead por isso (o lead segue sem estimativa automática).
        calcResult = null;
      }

      await leadService.createLead({
        ...data,
        inssEstimado: calcResult?.inssEstimado ?? null,
        economiaEstimada: calcResult?.economiaEstimada ?? null,
        percentualReducao: calcResult?.percentualReducao ?? null,
        valorAposReducao: calcResult?.valorAposReducao ?? null,
        detalheInterno: calcResult?.detalheInterno ?? null,
      });

      trackEvent('calculator_completed', {
        estado: data.estado,
        tipoObra: data.tipoObra,
      });
      setEnviado(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [data]);

  const reset = useCallback(() => {
    setData(INITIAL_CALCULATOR_DATA);
    setStep(1);
    setErrors({});
    setEnviado(false);
    setStarted(false);
  }, []);

  return { data, step, errors, enviado, isSubmitting, updateField, goNext, goBack, submit, reset };
}

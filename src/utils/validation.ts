import type { CalculatorData, FormErrors } from '@/types/calculator';
import { onlyDigits } from './formatters';

/**
 * Validação de WhatsApp brasileiro: aceita 10 dígitos (fixo) ou 11 dígitos (celular com 9º dígito),
 * sempre com DDD válido (11 a 99).
 */
export function isValidWhatsApp(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  if (digits.length === 11 && digits[2] !== '9') return false;

  return true;
}

/** Etapa 1 — Dados do cliente. */
export function validateStep1(data: Pick<CalculatorData, 'nome' | 'whatsapp'>): FormErrors<CalculatorData> {
  const errors: FormErrors<CalculatorData> = {};

  if (!data.nome.trim()) {
    errors.nome = 'Informe seu nome.';
  } else if (data.nome.trim().length < 2) {
    errors.nome = 'Informe um nome válido.';
  }

  if (!data.whatsapp.trim()) {
    errors.whatsapp = 'Informe seu WhatsApp.';
  } else if (!isValidWhatsApp(data.whatsapp)) {
    errors.whatsapp = 'Informe um WhatsApp válido, com DDD. Ex: (21) 98521-3949.';
  }

  return errors;
}

/** Etapa 2 — Dados da obra. */
export function validateStep2(
  data: Pick<
    CalculatorData,
    'dataInicio' | 'dataFim' | 'responsavel' | 'tipoObra' | 'situacao' | 'categoria' | 'estado' | 'destinacao'
  >
): FormErrors<CalculatorData> {
  const errors: FormErrors<CalculatorData> = {};

  if (!data.dataInicio) {
    errors.dataInicio = 'Informe a data de início da obra.';
  }

  if (data.dataInicio && data.dataFim) {
    const inicio = new Date(data.dataInicio);
    const fim = new Date(data.dataFim);
    if (fim < inicio) {
      errors.dataFim = 'A data de término não pode ser anterior à data de início.';
    }
  }

  if (!data.responsavel) {
    errors.responsavel = 'Selecione o responsável pela obra.';
  }

  if (!data.tipoObra) {
    errors.tipoObra = 'Selecione o tipo de obra.';
  }

  if (!data.situacao) {
    errors.situacao = 'Selecione a situação da obra.';
  }

  if (!data.categoria) {
    errors.categoria = 'Selecione a categoria da obra.';
  }

  if (!data.estado) {
    errors.estado = 'Selecione o estado da obra.';
  }

  if (!data.destinacao) {
    errors.destinacao = 'Selecione a destinação da obra.';
  }

  return errors;
}

/** Etapa 3 — Áreas e observações. */
export function validateStep3(
  data: Pick<CalculatorData, 'areaPrincipal' | 'areaPiscina'>
): FormErrors<CalculatorData> {
  const errors: FormErrors<CalculatorData> = {};

  if (data.areaPrincipal === null || Number.isNaN(data.areaPrincipal)) {
    errors.areaPrincipal = 'Informe a área da construção principal.';
  } else if (data.areaPrincipal <= 0) {
    errors.areaPrincipal = 'A área principal deve ser maior que zero.';
  }

  if (data.areaPiscina !== null && !Number.isNaN(data.areaPiscina) && data.areaPiscina < 0) {
    errors.areaPiscina = 'A área da piscina não pode ser negativa.';
  }

  return errors;
}

/** Validação completa dos dados de um lead/simulação — usada antes de calcular e/ou persistir. */
export function validateLead(data: CalculatorData): {
  isValid: boolean;
  errors: FormErrors<CalculatorData>;
} {
  const errors: FormErrors<CalculatorData> = {
    ...validateStep1(data),
    ...validateStep2(data),
    ...validateStep3(data),
  };

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Formata um número como moeda brasileira (R$ 0.000,00). */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formata um número como percentual (ex: 42%). */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Formata um número como percentual com 2 casas decimais (ex: 57,53%) — usado onde a precisão importa. */
export function formatPercentPrecise(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Aplica a máscara brasileira de WhatsApp: (XX) XXXXX-XXXX enquanto o usuário digita. */
export function maskWhatsApp(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Remove tudo que não for dígito de uma string de telefone. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formata uma data ISO (yyyy-mm-dd) para o formato brasileiro dd/mm/aaaa. Retorna '-' se vazio/inválido. */
export function formatDateBR(isoDate: string): string {
  if (!isoDate) return 'Não informado';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return 'Não informado';
  return `${day}/${month}/${year}`;
}

/** Formata uma área em m², com até 2 casas decimais quando necessário. */
export function formatArea(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'Não informado';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

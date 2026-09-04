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

/** Converte uma data ISO (yyyy-mm-dd) para dd/mm/aaaa, sem texto de fallback (usado em campos editáveis). */
export function isoToDateBRInput(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

/** Aplica a máscara dd/mm/aaaa enquanto o usuário digita (só dígitos, insere as barras). */
export function maskDateBR(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Converte "dd/mm/aaaa" (completo e válido) para ISO "yyyy-mm-dd". Retorna null se incompleta/inválida. */
export function parseDateBRToISO(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  if (year < 1900 || year > 2100) return null;
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/** Formata uma área em m², com até 2 casas decimais quando necessário. */
export function formatArea(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'Não informado';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

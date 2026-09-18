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

/**
 * Formata uma data ISO (yyyy-mm-dd, ou só yyyy-mm) para o formato brasileiro
 * mm/aaaa — usado nos campos de início/fim de obra, que só coletam mês e ano
 * (o "dia" armazenado internamente, sempre 01, não tem significado e por isso
 * nunca é exibido). Retorna 'Não informado' se vazio/inválido.
 */
export function formatDateBR(isoDate: string): string {
  if (!isoDate) return 'Não informado';
  const [year, month] = isoDate.split('-');
  if (!year || !month) return 'Não informado';
  return `${month}/${year}`;
}

/** Converte uma data ISO (yyyy-mm-dd ou yyyy-mm) para mm/aaaa, sem texto de fallback (usado em campos editáveis). */
export function isoToMonthBRInput(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month] = isoDate.split('-');
  if (!year || !month) return '';
  return `${month}/${year}`;
}

/** Aplica a máscara mm/aaaa enquanto o usuário digita (só dígitos, insere a barra). */
export function maskMonthBR(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Converte "mm/aaaa" (completo e válido) para ISO "yyyy-mm-01" — o dia é
 * sempre fixado em 01, já que o restante do sistema (cálculo de competências,
 * decadência etc.) trabalha com datas ISO completas, mas só o mês/ano
 * importam de fato para a obra. Retorna null se incompleta/inválida.
 */
export function parseMonthBRToISO(value: string): string | null {
  const match = /^(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, monthStr, yearStr] = match;
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;
  return `${yearStr}-${monthStr}-01`;
}

/** Formata uma área em m², com até 2 casas decimais quando necessário. */
export function formatArea(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'Não informado';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

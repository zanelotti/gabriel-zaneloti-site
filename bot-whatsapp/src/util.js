/** Funções pequenas usadas em vários arquivos. */

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export const aleatorio = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

export function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Normaliza o telefone do lead para o formato 55 + DDD + número (só dígitos).
 * O campo do site pede DDD + número; se já vier com 55, mantém.
 * Retorna null se não parecer um celular/fixo brasileiro válido.
 */
export function normalizarTelefoneBR(valor) {
  let d = soDigitos(valor);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  return `55${d}`;
}

export function primeiroNome(nome) {
  const first = String(nome ?? '').trim().split(/\s+/)[0] || '';
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function formatarReaisInteiros(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatarArea(valor) {
  return `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

export function dataHoraBR(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Mesma regra do site (notify-lead.js): quando a obra começou antes de 2021, o cálculo é pelo GFIP. */
export function regimeApuracao(dataInicio) {
  if (!dataInicio) return 'esocial';
  if (dataInicio >= '2021-10-01') return 'esocial';
  if (dataInicio >= '2021-01-01') return 'esocial_ajustado';
  return 'gfip_anterior_2021';
}

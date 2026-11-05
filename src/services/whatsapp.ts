import type { CalculatorData, INSSResult } from '@/types/calculator';
import { formatArea, formatCurrency, formatDateBR } from '@/utils/formatters';
import {
  CATEGORIA_LABEL,
  DESTINACAO_LABEL,
  RESPONSAVEL_LABEL,
  SITUACAO_LABEL,
  TIPO_OBRA_LABEL,
  estadoLabel,
} from '@/utils/labels';

/** Número de WhatsApp do Gabriel, em formato internacional (sem símbolos). */
export const WHATSAPP_NUMBER = '5521985213949';
export const WHATSAPP_NUMBER_DISPLAY = '+55 21 98521-3949';

/**
 * Monta a mensagem de WhatsApp a partir dos dados preenchidos na calculadora e do resultado da simulação.
 */
export function buildWhatsAppMessageText(data: CalculatorData, result: INSSResult): string {
  return [
    'Olá, Gabriel! Fiz uma simulação no seu site e gostaria de analisar a redução do INSS da minha obra.',
    '',
    `Nome: ${data.nome || 'Não informado'}`,
    `WhatsApp: ${data.whatsapp || 'Não informado'}`,
    `Início da obra: ${formatDateBR(data.dataInicio)}`,
    `Fim da obra: ${formatDateBR(data.dataFim)}`,
    `Responsável: ${RESPONSAVEL_LABEL[data.responsavel] ?? 'Não informado'}`,
    `Tipo de obra: ${TIPO_OBRA_LABEL[data.tipoObra] ?? 'Não informado'}`,
    `Situação: ${SITUACAO_LABEL[data.situacao] ?? 'Não informado'}`,
    `Categoria da obra: ${CATEGORIA_LABEL[data.categoria] ?? 'Não informado'}`,
    `Estado: ${estadoLabel(data.estado)}`,
    `Destinação: ${DESTINACAO_LABEL[data.destinacao] ?? 'Não informado'}`,
    `Área principal: ${formatArea(data.areaPrincipal)}`,
    `Área da piscina: ${formatArea(data.areaPiscina)}`,
    '',
    'Resultado estimado:',
    `INSS antes: ${formatCurrency(result.inssEstimado)}`,
    `Economia estimada: ${formatCurrency(result.economiaEstimada)}`,
    `INSS após redução: ${formatCurrency(result.valorAposReducao)}`,
    '',
    'Gostaria de saber como funciona a análise.',
  ].join('\n');
}

/** Gera a URL completa (wa.me) já com a mensagem codificada, pronta para abrir o WhatsApp. */
export function generateWhatsAppMessage(data: CalculatorData, result: INSSResult): string {
  const text = buildWhatsAppMessageText(data, result);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Mensagem usada quando a simulação não conseguiu gerar uma estimativa automática
 * (ex: data da obra fora da faixa suportada) — leva os dados da obra sem o resultado.
 */
export function buildFallbackWhatsAppMessageText(data: CalculatorData): string {
  return [
    'Olá, Gabriel! Tentei fazer uma simulação no seu site, mas não consegui ver o resultado. Segue o que preenchi:',
    '',
    `Nome: ${data.nome || 'Não informado'}`,
    `WhatsApp: ${data.whatsapp || 'Não informado'}`,
    `Início da obra: ${formatDateBR(data.dataInicio)}`,
    `Fim da obra: ${formatDateBR(data.dataFim)}`,
    `Responsável: ${RESPONSAVEL_LABEL[data.responsavel] ?? 'Não informado'}`,
    `Tipo de obra: ${TIPO_OBRA_LABEL[data.tipoObra] ?? 'Não informado'}`,
    `Categoria da obra: ${CATEGORIA_LABEL[data.categoria] ?? 'Não informado'}`,
    `Estado: ${estadoLabel(data.estado)}`,
    `Destinação: ${DESTINACAO_LABEL[data.destinacao] ?? 'Não informado'}`,
    `Área principal: ${formatArea(data.areaPrincipal)}`,
    `Área da piscina: ${formatArea(data.areaPiscina)}`,
    '',
    'Pode me ajudar a analisar?',
  ].join('\n');
}

export function generateFallbackWhatsAppMessage(data: CalculatorData): string {
  const text = buildFallbackWhatsAppMessageText(data);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/**
 * Mensagem da tela de confirmação do site: leva os dados da obra, mas NUNCA os
 * valores calculados (a conversa é quem apresenta o serviço).
 */
export function buildConfirmacaoWhatsAppMessageText(data: CalculatorData): string {
  return [
    'Olá, Gabriel! Acabei de enviar os dados da minha obra pelo site e gostaria de conversar sobre a redução do INSS.',
    '',
    `Nome: ${data.nome || 'Não informado'}`,
    `Início da obra: ${formatDateBR(data.dataInicio)}`,
    `Fim da obra: ${formatDateBR(data.dataFim)}`,
    `Responsável: ${RESPONSAVEL_LABEL[data.responsavel] ?? 'Não informado'}`,
    `Estado: ${estadoLabel(data.estado)}`,
    `Destinação: ${DESTINACAO_LABEL[data.destinacao] ?? 'Não informado'}`,
    `Área principal: ${formatArea(data.areaPrincipal)}`,
  ].join('\n');
}

export function generateConfirmacaoWhatsAppLink(data: CalculatorData): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildConfirmacaoWhatsAppMessageText(data))}`;
}

/** Gera uma URL simples de WhatsApp, sem dados de simulação — usada no botão flutuante e nos CTAs gerais. */
export function generateGenericWhatsAppLink(message?: string): string {
  const defaultMessage = 'Olá, Gabriel! Gostaria de saber mais sobre a redução do INSS da minha obra.';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message ?? defaultMessage)}`;
}

/**
 * WhatsApp para quem acabou de baixar o e-book "Como reduzir o INSS da sua obra".
 * A mensagem termina com o código "(ref: site-ebook)": é assim que o bot do WhatsApp reconhece de onde a pessoa veio.
 */
export function generateEbookWhatsAppLink(nome?: string): string {
  const quem = nome && nome.trim() ? ` Meu nome é ${nome.trim()}.` : '';
  const texto = `Olá, Gabriel! Baixei o e-book "Como reduzir o INSS da sua obra" e gostaria de saber se a minha obra tem redução.${quem}\n\n(ref: site-ebook)`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
}

/**
 * ============================================================================
 *  BOTÕES DE WHATSAPP DO SITE → BOT
 * ============================================================================
 * Cada botão abre o WhatsApp com uma mensagem pronta que termina com um código, por exemplo "(ref: site-dores)".
 * O bot do WhatsApp (bot-whatsapp/src/origem.js) lê esse código, cria o card no CRM e conversa de acordo com o botão.
 * Os códigos e as frases abaixo precisam ser os mesmos do bot: se mudar um, avise para mudar o outro.
 */
export type OrigemWhatsApp = 'topo' | 'beneficios' | 'dores' | 'tranquilidade' | 'final' | 'flutuante' | 'rodape';

const FRASE_ORIGEM: Record<OrigemWhatsApp, string> = {
  topo: 'quero saber como reduzir o INSS da minha obra',
  beneficios: 'quero entender como funciona a regularização do INSS da minha obra',
  dores: 'me identifiquei com uma das situações e quero falar sobre a minha obra',
  tranquilidade: 'quero deixar a minha obra em dia, sem dor de cabeça com a Receita',
  final: 'quero começar a análise gratuita da minha obra',
  flutuante: 'tenho uma dúvida sobre o INSS da minha obra',
  rodape: 'tenho uma dúvida sobre o INSS da minha obra',
};

/** Nome usado no analytics (`origem` do trackEvent) → código que vai na mensagem para o bot. */
const ORIGEM_ANALYTICS: Record<string, OrigemWhatsApp> = {
  hero: 'topo',
  beneficios: 'beneficios',
  dores: 'dores',
  tranquilidade: 'tranquilidade',
  cta_final: 'final',
  botao_flutuante: 'flutuante',
  rodape: 'rodape',
};

/** Mensagem pronta do botão. Aceita o código do bot ("dores") ou o nome do analytics ("cta_final"); desconhecido vira "topo". */
export function buildOrigemWhatsAppMessage(origem: string): string {
  const codigo: OrigemWhatsApp = ORIGEM_ANALYTICS[origem] ?? (origem in FRASE_ORIGEM ? (origem as OrigemWhatsApp) : 'topo');
  return `Olá, Gabriel! Vim pelo seu site e ${FRASE_ORIGEM[codigo]}.\n\n(ref: site-${codigo})`;
}

export function generateOrigemWhatsAppLink(origem: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildOrigemWhatsAppMessage(origem))}`;
}

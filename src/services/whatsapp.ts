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

/** Gera uma URL simples de WhatsApp, sem dados de simulação — usada no botão flutuante e nos CTAs gerais. */
export function generateGenericWhatsAppLink(message?: string): string {
  const defaultMessage = 'Olá, Gabriel! Gostaria de saber mais sobre a redução do INSS da minha obra.';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message ?? defaultMessage)}`;
}

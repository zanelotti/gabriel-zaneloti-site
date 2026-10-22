import type { BotConversa, BotMensagemResumo, BotUso } from '@/services/botService';

/** Preço do modelo do bot (Claude Sonnet 5.5), em dólares por milhão de tokens. */
export const PRECO_ENTRADA_USD_POR_MTOK = 2;
export const PRECO_SAIDA_USD_POR_MTOK = 10;

export interface BotMetricas {
  abordados: number;
  responderam: number;
  taxaResposta: number;
  passaramParaVoce: number;
  agendados: number;
  taxaAgendamento: number;
  pediramParar: number;
  mensagensBot: number;
  mensagensLead: number;
  mensagensGabriel: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  custoBrl: number;
  custoPorLeadBrl: number;
  porDia: { label: string; value: number }[];
}

export function estaEmEspera(c: Pick<BotConversa, 'estado' | 'observacao'>): boolean {
  return c.estado === 'ativa' && (c.observacao ?? '').startsWith('ESPERA_GABRIEL');
}

export function calcularCustoUsd(entrada: number, saida: number): number {
  return (entrada / 1_000_000) * PRECO_ENTRADA_USD_POR_MTOK + (saida / 1_000_000) * PRECO_SAIDA_USD_POR_MTOK;
}

function chaveDia(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Calcula as métricas do período (últimos `dias` dias; `dias = 0` significa tudo o que foi carregado).
 * `agora` existe só para tornar o cálculo testável.
 */
export function calcularMetricas(
  conversas: BotConversa[],
  mensagens: BotMensagemResumo[],
  usos: BotUso[],
  dias: number,
  cambio: number,
  agora: Date = new Date()
): BotMetricas {
  const desde = dias > 0 ? agora.getTime() - dias * 24 * 3600 * 1000 : 0;
  const noPeriodo = (iso: string) => Date.parse(iso) >= desde;

  const msgsPeriodo = mensagens.filter((m) => noPeriodo(m.criadoEm));
  const conversasDoPeriodo = conversas.filter((c) => noPeriodo(c.criadoEm));

  const comMensagemDoBot = new Set(msgsPeriodo.filter((m) => m.direcao === 'bot').map((m) => m.conversaId));
  const comMensagemDoLead = new Set(msgsPeriodo.filter((m) => m.direcao === 'lead').map((m) => m.conversaId));

  const abordadas = conversasDoPeriodo.filter((c) => comMensagemDoBot.has(c.id));
  const abordados = abordadas.length;
  const responderam = abordadas.filter((c) => comMensagemDoLead.has(c.id)).length;
  const passaram = abordadas.filter((c) => c.estado === 'humano' || estaEmEspera(c)).length;
  const agendados = conversas.filter((c) => c.agendouEm && noPeriodo(c.agendouEm)).length;
  const pediramParar = abordadas.filter((c) => c.estado === 'optout').length;

  const usosPeriodo = usos.filter((u) => noPeriodo(u.criadoEm));
  const tokensEntrada = usosPeriodo.reduce((s, u) => s + u.entrada, 0);
  const tokensSaida = usosPeriodo.reduce((s, u) => s + u.saida, 0);
  const custoUsd = calcularCustoUsd(tokensEntrada, tokensSaida);
  const custoBrl = custoUsd * cambio;

  // Mensagens do bot por dia nos últimos 14 dias (sempre 14 colunas, mesmo com dias sem mensagem).
  const porDiaMapa = new Map<string, number>();
  for (const m of mensagens) if (m.direcao === 'bot') porDiaMapa.set(chaveDia(m.criadoEm), (porDiaMapa.get(chaveDia(m.criadoEm)) ?? 0) + 1);
  const porDia: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 24 * 3600 * 1000);
    const chave = chaveDia(d.toISOString());
    const [, mes, dia] = chave.split('-');
    porDia.push({ label: `${dia}/${mes}`, value: porDiaMapa.get(chave) ?? 0 });
  }

  return {
    abordados,
    responderam,
    taxaResposta: abordados > 0 ? (responderam / abordados) * 100 : 0,
    passaramParaVoce: passaram,
    agendados,
    taxaAgendamento: abordados > 0 ? (agendados / abordados) * 100 : 0,
    pediramParar,
    mensagensBot: msgsPeriodo.filter((m) => m.direcao === 'bot').length,
    mensagensLead: msgsPeriodo.filter((m) => m.direcao === 'lead').length,
    mensagensGabriel: msgsPeriodo.filter((m) => m.direcao === 'humano').length,
    tokensEntrada,
    tokensSaida,
    custoUsd,
    custoBrl,
    custoPorLeadBrl: abordados > 0 ? custoBrl / abordados : 0,
    porDia,
  };
}

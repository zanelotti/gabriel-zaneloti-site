/**
 * "Cérebro" do bot: monta a conversa, chama o Claude, executa as ferramentas
 * (horários, agendamento, passar para o Gabriel...) e só devolve texto que
 * passou nas travas de conteúdo (guards.js).
 */
import Anthropic from '@anthropic-ai/sdk';
import { dividirMensagens, validarSaida } from './guards.js';
import { formatarTrechos } from './documentos.js';
import { montarSistema } from './prompt.js';

export const FERRAMENTAS = [
  {
    name: 'ver_horarios',
    description:
      'Lista horários livres para a consultoria gratuita com o Gabriel (a partir de 24h depois de agora). Use quando a pessoa topar a consultoria. Ofereça 2 ou 3 opções.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'agendar_consultoria',
    description:
      'Marca a consultoria gratuita. Precisa do e-mail da pessoa e de um horário exato devolvido por ver_horarios (campo "inicio").',
    input_schema: {
      type: 'object',
      properties: {
        inicio: { type: 'string', description: 'Horário escolhido, exatamente como veio em ver_horarios (ISO).' },
        email: { type: 'string', description: 'E-mail da pessoa.' },
      },
      required: ['inicio', 'email'],
      additionalProperties: false,
    },
  },
  {
    name: 'passar_para_gabriel',
    description:
      'Encerra a participação do assistente e avisa o Gabriel para continuar pessoalmente. Escreva também uma mensagem curta ao lead dizendo que o Gabriel continua a conversa.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Por que está passando (ex.: pediu desconto, dúvida técnica).' },
        resumo: { type: 'string', description: 'Resumo de 1 a 3 frases do que a pessoa quer e do ponto em que a conversa está.' },
      },
      required: ['motivo', 'resumo'],
      additionalProperties: false,
    },
  },
  {
    name: 'encerrar_conversa',
    description: 'Encerra a conversa quando a pessoa deixou claro que não quer seguir ou já resolveu de outro jeito.',
    input_schema: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: ['motivo'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_status',
    description: 'Atualiza o status do lead no funil do Gabriel, quando houver mudança real.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['contatado', 'decidindo', 'proposta_enviada', 'perdido'] },
        nota: { type: 'string', description: 'Observação curta para o Gabriel.' },
      },
      required: ['status'],
      additionalProperties: false,
    },
  },
];

const TEXTO_PADRAO = {
  passar: 'Vou pedir para o Gabriel continuar essa conversa com você pessoalmente, ele te responde por aqui.',
  encerrar: 'Tudo bem! Obrigado pelo seu tempo. Se mudar de ideia ou surgir alguma dúvida, é só me chamar por aqui.',
};

/** Converte o histórico do banco em mensagens da API (alternando user/assistant, começando por user). */
export function montarHistorico(historico) {
  const base = [
    {
      role: 'user',
      content:
        '[Nota do sistema: o lead acabou de preencher a calculadora do site. A primeira mensagem abaixo já foi enviada por você. Continue a conversa a partir das mensagens do lead.]',
    },
  ];
  for (const m of historico) {
    const role = m.direcao === 'lead' ? 'user' : 'assistant';
    const ultimo = base[base.length - 1];
    if (ultimo.role === role && typeof ultimo.content === 'string') {
      ultimo.content += `\n\n${m.texto}`;
    } else {
      base.push({ role, content: m.texto });
    }
  }
  if (base[base.length - 1].role !== 'user') {
    base.push({ role: 'user', content: '[Nota do sistema: continue a conversa de forma natural.]' });
  }
  return base;
}

export function criarCerebro({ apiKey, modelo, config, client, conhecimento = { texto: '', valores: [] }, documentos = null }) {
  const anthropic = client || new Anthropic({ apiKey });

  /**
   * @returns {Promise<{mensagens: string[], acao: null | {tipo: 'passar'|'encerrar', motivo: string, resumo?: string}}>}
   */
  async function gerarResposta({ lead, historico, ferramentas, log = console }) {
    // Busca nos documentos grandes (normativa, manual) os trechos ligados ao que o lead disse por último.
    let trechos = { texto: '', valores: [] };
    if (documentos && documentos.total > 0) {
      try {
        const consulta = historico
          .filter((m) => m.direcao === 'lead')
          .slice(-3)
          .map((m) => m.texto)
          .join(' ');
        trechos = formatarTrechos(documentos.buscar(consulta, { k: 4 }));
      } catch (e) {
        log.warn(`[cerebro] busca nos documentos falhou: ${e.message}`);
      }
    }
    const valoresExtras = [...conhecimento.valores, ...trechos.valores];
    const system = montarSistema(lead, config, conhecimento.texto, trechos.texto);
    const messages = montarHistorico(historico);
    let acao = null;
    let bloqueios = 0;
    let ultimoMotivo = '';

    for (let rodada = 0; rodada < 8; rodada++) {
      const resp = await anthropic.messages.create({
        model: modelo,
        max_tokens: 700,
        system,
        tools: FERRAMENTAS,
        messages,
      });

      const blocos = resp.content || [];
      const usos = blocos.filter((b) => b.type === 'tool_use');
      const texto = blocos
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim();

      if (usos.length > 0) {
        messages.push({ role: 'assistant', content: blocos });
        const resultados = [];
        for (const uso of usos) {
          try {
            const fn = ferramentas[uso.name];
            if (!fn) throw new Error(`ferramenta desconhecida: ${uso.name}`);
            const saida = await fn(uso.input || {});
            if (uso.name === 'passar_para_gabriel') {
              acao = { tipo: 'passar', motivo: uso.input?.motivo || '', resumo: uso.input?.resumo || '' };
            } else if (uso.name === 'encerrar_conversa') {
              acao = { tipo: 'encerrar', motivo: uso.input?.motivo || '' };
            }
            resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(saida ?? { ok: true }) });
          } catch (e) {
            log.error(`[cerebro] ferramenta ${uso.name} falhou:`, e.message);
            resultados.push({ type: 'tool_result', tool_use_id: uso.id, is_error: true, content: `erro: ${e.message}` });
          }
        }
        messages.push({ role: 'user', content: resultados });

        if (acao) {
          // Ação terminal: usa o texto que o modelo escreveu junto (se passar nas travas) ou um padrão seguro.
          const v = texto ? validarSaida(texto, lead, valoresExtras) : { ok: false };
          const msgs = v.ok ? dividirMensagens(texto) : [TEXTO_PADRAO[acao.tipo]];
          return { mensagens: msgs, acao };
        }
        continue;
      }

      // Resposta final em texto
      const v = validarSaida(texto, lead, valoresExtras);
      if (v.ok) return { mensagens: dividirMensagens(texto), acao };

      bloqueios += 1;
      ultimoMotivo = v.motivo;
      log.warn(`[cerebro] resposta bloqueada (${v.motivo}). Tentativa ${bloqueios}.`);
      if (bloqueios >= 3) break;
      messages.push({ role: 'assistant', content: texto || '(vazio)' });
      messages.push({
        role: 'user',
        content: `[AVISO INTERNO, não mencione ao lead: a mensagem anterior foi bloqueada porque ${v.motivo}. Reescreva a resposta respeitando as regras, mais curta e sem esse problema.]`,
      });
    }

    // Não conseguiu produzir uma resposta segura: passa para o Gabriel em vez de arriscar.
    return {
      mensagens: [TEXTO_PADRAO.passar],
      acao: { tipo: 'passar', motivo: `Resposta bloqueada pelas travas de conteúdo (${ultimoMotivo || 'sem resposta'})`, resumo: '' },
    };
  }

  return { gerarResposta };
}

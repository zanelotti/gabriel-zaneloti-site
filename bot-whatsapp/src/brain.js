/**
 * "Cérebro" do bot: monta a conversa, chama o Claude, executa as ferramentas
 * (horários, agendamento, passar para o Gabriel...) e só devolve texto que
 * passou nas travas de conteúdo (guards.js).
 */
import Anthropic from '@anthropic-ai/sdk';
import { dividirMensagens, falaDeHonorario, leadPerguntouPreco, muitoLonga, passagemJustificada, repeticaoExcessiva, validarSaida } from './guards.js';
import { citouHonorarios } from './funil.js';
import { formatarTrechos } from './documentos.js';
import { formatarAprendidos } from './aprendizado.js';
import { montarSistema } from './prompt.js';
import { criarChamador, leadValorAlto, primeiroNome, primeiroNomePessoa } from './util.js';

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
      'Encerra a participação do assistente e avisa o Gabriel para continuar pessoalmente. Escreva também uma mensagem curta ao lead dizendo que o Gabriel continua a conversa. NÃO use nas primeiras respostas só porque a pessoa pediu uma explicação geral ("como funciona?"): explique você mesma. Use só por motivo claro (pediu pessoa ou desconto, irritação, documentos, pronta para contratar, dúvida técnica sem base).',
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
      properties: {
        motivo: { type: 'string' },
        motivo_perda: { type: 'string', enum: ['preco', 'vai_fazer_sozinho', 'desconfianca', 'ja_resolveu', 'sem_interesse', 'outro'], description: 'Categoria do motivo (preco = achou caro; vai_fazer_sozinho; desconfianca; ja_resolveu = já resolveu com outro profissional ou já regularizou; sem_interesse; outro).' },
      },
      required: ['motivo'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_nome',
    description: 'Guarda o nome pelo qual a pessoa quer ser chamada (quando ela disser como prefere ser tratada).',
    input_schema: {
      type: 'object',
      properties: { nome: { type: 'string', description: 'Nome informado pela pessoa, só o nome (ex.: "João").' } },
      required: ['nome'],
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
        motivo_perda: { type: 'string', enum: ['preco', 'vai_fazer_sozinho', 'desconfianca', 'ja_resolveu', 'sem_interesse', 'outro'], description: 'Obrigatório quando status = perdido.' },
      },
      required: ['status'],
      additionalProperties: false,
    },
  },
];

/** Só é oferecida quando existe a pasta de documentos (normativa, manual do SERO...). */
const FERRAMENTA_DOCUMENTOS = {
  name: 'consultar_documentos',
  description:
    'Pesquisa na normativa e nos manuais oficiais (IN RFB 2.021/2021, Manual do SERO etc.). Use quando a pessoa perguntar COMO algo funciona (como reduz, o que conta como crédito, pré-moldado, decadência, documentos) e os trechos já fornecidos não responderem. Passe de 3 a 8 palavras-chave TÉCNICAS, não a frase da pessoa (ex.: "nota fiscal pré-moldado redução remuneração", "crédito remuneração GFIP eSocial CNO", "decadência cinco anos prova").',
  input_schema: {
    type: 'object',
    properties: { termos: { type: 'string', description: 'Palavras-chave técnicas separadas por espaço.' } },
    required: ['termos'],
    additionalProperties: false,
  },
};
const MAX_CONSULTAS = 3;
// Folga grande de propósito: se o modelo "pensar" antes de responder, esses tokens também contam, e um limite curto corta a mensagem no meio da frase.
const MAX_TOKENS_RESPOSTA = 4000;

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

export function criarCerebro({ apiKey, modelo, config, client, conhecimento = { texto: '', valores: [] }, documentos = null, aprendizado = null }) {
  const anthropic = client || new Anthropic({ apiKey });
  const chamar = criarChamador(anthropic);

  /**
   * @returns {Promise<{mensagens: string[], acao: null | {tipo: 'passar'|'encerrar', motivo: string, resumo?: string}}>}
   */
  async function gerarResposta({ lead, historico, ferramentas, log = console, espera = null, nomeContato = '' }) {
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
    // Respostas que o Gabriel já deu a dúvidas parecidas (aprendidas das conversas dele com outros leads).
    let aprendidos = '';
    if (aprendizado && aprendizado.total > 0) {
      try {
        const consultaL = historico
          .filter((m) => m.direcao === 'lead')
          .slice(-3)
          .map((m) => m.texto)
          .join(' ');
        aprendidos = formatarAprendidos(aprendizado.buscar(consultaL, { k: 3 }));
      } catch (e) {
        log.warn(`[cerebro] busca no aprendizado falhou: ${e.message}`);
      }
    }
    // O parcelamento é um diferencial que a assistente precisa citar em algum momento (a abertura não fala dele).
    const parcelamentoCitado = historico.some((m) => m.direcao !== 'lead' && /parcel/i.test(m.texto || ''));
    // Cautela com preço: o honorário só entra na conversa quando a pessoa pergunta (ou, em lead comum, depois de algumas trocas).
    // Em lead de valor alto (honorário grande) só quando ela pergunta. Nunca o bot oferece "mostrar a conta com o honorário" por conta própria.
    const msgsLead = historico.filter((m) => m.direcao === 'lead');
    const perguntouPreco = leadPerguntouPreco(msgsLead.slice(-2).map((m) => m.texto).join(' '));
    const jaFalouHonorario = historico.some((m) => m.direcao !== 'lead' && citouHonorarios(m.texto));
    const valorAlto = leadValorAlto(lead, config);
    const precoPrematuro = (t) => falaDeHonorario(t) && !perguntouPreco && !jaFalouHonorario && (valorAlto || msgsLead.length < 3);
    const MOTIVO_PRECO_CEDO =
      'fala de honorário/preço, mas a pessoa não perguntou o custo e ainda é cedo (ou o caso é de valor alto e pede cautela). Reescreva SEM citar honorário, percentual do Gabriel nem oferecer "mostrar a conta": passe valor do serviço ligado ao caso dela, mostre confiança e, se já tiver trocado algumas mensagens, ofereça a conversa rápida com o Gabriel (sem compromisso)';
    const valoresExtras = [...conhecimento.valores, ...trechos.valores];
    const temBusca = (documentos && documentos.total > 0) || (aprendizado && aprendizado.total > 0);
    const ferramentasApi = temBusca ? [...FERRAMENTAS, FERRAMENTA_DOCUMENTOS] : FERRAMENTAS;
    let consultas = 0;
    const system = montarSistema(lead, config, conhecimento.texto, trechos.texto, espera, nomeContato, aprendidos, parcelamentoCitado);
    const messages = montarHistorico(historico);
    let acao = null;
    const consumo = { entrada: 0, saida: 0 };
    let bloqueios = 0;
    let jaPediuResumo = false;
    let jaPediuVariar = false;
    const nomesDaPessoa = [primeiroNome(nomeContato), primeiroNomePessoa(lead.nome)].filter(Boolean);
    let ultimoMotivo = '';

    for (let rodada = 0; rodada < 8; rodada++) {
      const resp = await chamar({
        model: modelo,
        max_tokens: MAX_TOKENS_RESPOSTA,
        system,
        tools: ferramentasApi,
        messages,
      });

      if (resp.stop_reason && !['end_turn', 'tool_use'].includes(resp.stop_reason)) {
        log.warn(`[cerebro] o Claude parou com motivo "${resp.stop_reason}" (${resp.usage?.output_tokens ?? '?'} tokens de saída).`);
      }
      consumo.entrada += resp.usage?.input_tokens || 0;
      consumo.saida += resp.usage?.output_tokens || 0;
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
          if (uso.name === 'consultar_documentos') {
            consultas += 1;
            let saida;
            if (!temBusca) saida = { erro: 'sem documentos disponíveis' };
            else if (consultas > MAX_CONSULTAS) saida = { erro: 'limite de consultas atingido; responda com o que já tem ou use passar_para_gabriel' };
            else {
              const termos = String(uso.input?.termos || '');
              const achados = documentos && documentos.total > 0 ? formatarTrechos(documentos.buscar(termos, { k: 4 })) : { texto: '', valores: [] };
              valoresExtras.push(...achados.valores);
              const jaResp = aprendizado && aprendizado.total > 0 ? formatarAprendidos(aprendizado.buscar(termos, { k: 2 })) : '';
              const partes = [achados.texto, jaResp ? `Respostas anteriores do Gabriel a dúvidas parecidas:\n${jaResp}` : ''].filter(Boolean);
              saida = partes.length
                ? { trechos: partes.join('\n\n') }
                : { trechos: 'Nada encontrado com esses termos. Tente outras palavras-chave técnicas ou use o CONHECIMENTO.' };
            }
            resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(saida) });
            continue;
          }
          try {
            if (uso.name === 'passar_para_gabriel' && !espera && msgsLead.length <= 2 && !passagemJustificada(uso.input?.motivo)) {
              // Cedo demais: "me explica como funciona" não é motivo para largar o lead. Devolve a vez para a assistente responder.
              resultados.push({
                type: 'tool_result',
                tool_use_id: uso.id,
                content: JSON.stringify({ ok: false, erro: 'Ainda é cedo para passar para o Gabriel e esse motivo não justifica. Responda você mesma: explique em 2 ou 3 frases curtas como o serviço funciona (use o CONHECIMENTO) e faça UMA pergunta para entender a obra dela.' }),
              });
              continue;
            }
            const fn = ferramentas[uso.name];
            if (!fn) throw new Error(`ferramenta desconhecida: ${uso.name}`);
            const saida = await fn(uso.input || {});
            if (uso.name === 'passar_para_gabriel') {
              acao = { tipo: 'passar', motivo: uso.input?.motivo || '', resumo: uso.input?.resumo || '' };
            } else if (uso.name === 'encerrar_conversa') {
              acao = { tipo: 'encerrar', motivo: uso.input?.motivo || '', motivo_perda: uso.input?.motivo_perda || '' };
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
          const v = texto && !precoPrematuro(texto) ? validarSaida(texto, lead, valoresExtras) : { ok: false };
          const msgs = v.ok ? dividirMensagens(texto) : [TEXTO_PADRAO[acao.tipo]];
          return { mensagens: msgs, acao, uso: consumo };
        }
        continue;
      }

      // Resposta final em texto. Se foi cortada por limite de tamanho, NUNCA envia (sairia pela metade).
      const cortada = resp.stop_reason === 'max_tokens';
      let v = cortada
        ? { ok: false, motivo: 'a resposta foi cortada por ser longa demais (escreva mais curta, em no máximo 3 mensagens pequenas)' }
        : validarSaida(texto, lead, valoresExtras);
      if (v.ok && precoPrematuro(texto)) v = { ok: false, motivo: MOTIVO_PRECO_CEDO };
      if (v.ok && muitoLonga(texto) && !jaPediuResumo) {
        // Resposta correta mas comprida: pede UMA reescrita mais curta (não conta como bloqueio; se continuar longa, envia assim mesmo).
        jaPediuResumo = true;
        log.warn(`[cerebro] resposta longa (${texto.length} caracteres); pedindo versão mais curta.`);
        messages.push({ role: 'assistant', content: texto });
        messages.push({
          role: 'user',
          content: '[AVISO INTERNO, não mencione ao lead: a resposta anterior ficou comprida demais para WhatsApp e o lead perde a paciência. Reescreva em no máximo 2 frases curtas (3 ou 4 só se for dar o preço ou explicar um mecanismo), uma técnica e uma pergunta, deixando o resto para as próximas mensagens. Mantenha todas as regras.]',
        });
        continue;
      }
      if (v.ok && !jaPediuVariar) {
        // Repete o nome da pessoa, o nome do Gabriel, a abertura ou uma pergunta: pede UMA reescrita (se continuar igual, envia assim mesmo).
        const rep = repeticaoExcessiva(texto, historico, nomesDaPessoa);
        if (rep) {
          jaPediuVariar = true;
          log.warn(`[cerebro] resposta repetitiva (${rep}); pedindo outra versão.`);
          messages.push({ role: 'assistant', content: texto });
          messages.push({
            role: 'user',
            content: `[AVISO INTERNO, não mencione ao lead: a resposta anterior ficou repetitiva porque ${rep}. Reescreva mais direta e objetiva: sem chamar a pessoa pelo nome nem repetir o nome do Gabriel à toa, sem repetir ressalvas ou perguntas já feitas, no máximo UMA pergunta e só se ela mudar o próximo passo. Mantenha todas as regras.]`,
          });
          continue;
        }
      }
      if (v.ok) return { mensagens: dividirMensagens(texto), acao, uso: consumo };

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
      uso: consumo,
    };
  }

  return { gerarResposta };
}

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

const SEM_ACENTO = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Palavras que indicam empresa/organização (e não o nome de uma pessoa).
const PALAVRAS_DE_EMPRESA = new Set(
  (
    'ltda ltd me mei epp eireli sa cia companhia construtora construtoras construcao construcoes engenharia empreendimentos empreendimento ' +
    'incorporadora incorporacoes imobiliaria imoveis comercio servicos servico industria industrias grupo holding associacao condominio ' +
    'instituto clinica escritorio arquitetura projetos reformas obras engenheiros arquitetos consultoria assessoria agro transportes ' +
    'transportadora locacao empreiteira sociedade fundacao igreja prefeitura loja mercado supermercado hotel pousada restaurante ' +
    'distribuidora comercial materiais concreto madeireira marmoraria metalurgica tecnologia solucoes sistemas participacoes patrimonial ' +
    'construtech tech investimentos gestao negocios importadora exportadora cooperativa sindicato ong'
  ).split(' ')
);

/** O texto digitado no cadastro parece o nome de uma pessoa (e não uma empresa, sigla ou vazio)? */
export function nomeParecePessoa(nome) {
  const bruto = String(nome ?? '').trim();
  if (!bruto) return false;
  if (/[0-9@&/\\_]/.test(bruto)) return false;
  const tokens = SEM_ACENTO(bruto).split(/[^a-z]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return false;
  if (tokens.some((t) => PALAVRAS_DE_EMPRESA.has(t))) return false;
  if (tokens.length === 1 && tokens[0].length <= 3) return false; // sigla, ex.: "JMX"
  return true;
}

/** Primeiro nome só quando o cadastro parece um nome de pessoa; caso contrário, vazio. */
export function primeiroNomePessoa(nome) {
  return nomeParecePessoa(nome) ? primeiroNome(nome) : '';
}

/** Limpa o nome que a pessoa informou no WhatsApp ("me chama de joão" → "João"). Vazio se não parecer um nome. */
export function limparNomeInformado(nome) {
  let t = String(nome ?? '').trim().replace(/^(me chamo|meu nome é|meu nome e|sou o|sou a|pode me chamar de|me chama de|aqui é o|aqui é a|aqui é)\s+/i, '');
  t = t.replace(/[.!,;:]+$/g, '').trim();
  if (!t || t.length > 40 || /[0-9@/\\_]/.test(t)) return '';
  const partes = t.split(/\s+/);
  if (partes.length > 3) return '';
  return partes.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
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

// --- Honorários -------------------------------------------------------------
export const HONORARIO_PERCENTUAL = 0.12;
export const HONORARIO_MINIMO_PF = 600;
export const HONORARIO_BASE_PJ = 1000;

/**
 * Honorário do Gabriel calculado em código (o modelo nunca faz essa conta):
 *  - Pessoa física: 12% da economia estimada pela calculadora; se der menos de R$ 600, fica R$ 600.
 *  - Pessoa jurídica: R$ 1.000 mais 12% sobre a economia que for conseguida (confirmada só na análise).
 */
export function calcularHonorario(lead) {
  if (lead?.responsavel === 'PJ') return { tipo: 'PJ', base: HONORARIO_BASE_PJ };
  const eco = lead?.economia_estimada;
  if (eco === null || eco === undefined || eco === '' || !Number.isFinite(Number(eco))) {
    return { tipo: 'PF', economiaConhecida: false, minimoAplicado: false };
  }
  const bruto = Number(eco) * HONORARIO_PERCENTUAL;
  if (bruto < HONORARIO_MINIMO_PF) {
    return { tipo: 'PF', economiaConhecida: true, valor: HONORARIO_MINIMO_PF, doze: Math.round(bruto), minimoAplicado: true };
  }
  return { tipo: 'PF', economiaConhecida: true, valor: Math.round(bruto), minimoAplicado: false };
}

/**
 * Chamada ao Claude com o "pensamento" desligado: num bot de WhatsApp ele só gasta tokens (e tempo) e,
 * com limite curto de resposta, chegou a cortar mensagens no meio da frase. Se a API recusar o parâmetro,
 * tenta de novo sem ele e passa a chamar sempre sem.
 */
export function criarChamador(anthropic, log = console) {
  let comParametro = true;
  return async function chamar(params) {
    if (comParametro) {
      try {
        return await anthropic.messages.create({ ...params, thinking: { type: 'disabled' } });
      } catch (e) {
        if (e?.status === 400 && /thinking/i.test(String(e?.message))) {
          comParametro = false;
          log.warn('[claude] a API não aceitou desligar o pensamento; seguindo sem esse parâmetro.');
        } else {
          throw e;
        }
      }
    }
    return anthropic.messages.create(params);
  };
}

/**
 * ============================================================================
 *  PROGRAMA DE PARCEIROS — cadastro
 * ============================================================================
 * O profissional (engenheiro, contador, arquiteto...) preenche o formulário em
 * /parceiros.html e recebe na hora o seu link com código (`/?ref=codigo`). O
 * código é gerado aqui, enviado para a função serverless `/api/notify-parceiro`
 * (que avisa o Gabriel por e-mail e grava na tabela `parceiros`) e, quando um
 * lead entra por esse link, o código vai junto (ver attribution.ts/leadService.ts).
 * ============================================================================
 */

export const PROFISSOES = [
  'Engenheiro(a)',
  'Arquiteto(a)',
  'Contador(a)',
  'Construtora / empreiteiro(a)',
  'Corretor(a) / imobiliária',
  'Outro',
] as const;

export interface ParceiroInput {
  nome: string;
  profissao: string;
  cidade: string;
  whatsapp: string;
  email: string;
  /** Campo-isca anti-spam: pessoas não veem nem preenchem; robôs sim. */
  website?: string;
}

export interface ParceiroCadastrado {
  codigo: string;
  link: string;
}

const SITE = 'https://www.gabrielzaneloti.com.br';

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Ex.: "João da Silva" -> "joao-k3x9". */
export function gerarCodigo(nome: string): string {
  const primeiro = semAcento(nome).toLowerCase().trim().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'parceiro';
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
  let sufixo = '';
  const bytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) sufixo += alfabeto[b % alfabeto.length];
  return `${primeiro.length >= 3 ? primeiro : 'parc'}-${sufixo}`;
}

export function linkDoParceiro(codigo: string): string {
  return `${SITE}/?ref=${codigo}`;
}

export const parceiroService = {
  /** Cadastra o parceiro. Só devolve o link se o Gabriel realmente recebeu o cadastro (e-mail ou banco). */
  async cadastrar(input: ParceiroInput): Promise<ParceiroCadastrado> {
    const codigo = gerarCodigo(input.nome);
    const resposta = await fetch('/api/notify-parceiro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, codigo }),
    });
    const dados = (await resposta.json().catch(() => null)) as { ok?: boolean } | null;
    if (!resposta.ok || !dados?.ok) throw new Error('cadastro_nao_recebido');
    return { codigo, link: linkDoParceiro(codigo) };
  },
};

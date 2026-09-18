import { BRAZILIAN_STATES } from '@/data/states';

/**
 * Rótulos em português para os valores internos (enums/strings) usados na
 * calculadora — centralizados aqui para não duplicar o mesmo mapa em vários
 * lugares (mensagem de WhatsApp, resumo de dados no resultado, etc).
 */

export const RESPONSAVEL_LABEL: Record<string, string> = {
  PF: 'Pessoa Física',
  PJ: 'Pessoa Jurídica',
};

export const TIPO_OBRA_LABEL: Record<string, string> = {
  alvenaria: 'Alvenaria',
  madeira: 'Madeira',
  mista: 'Mista',
};

export const SITUACAO_LABEL: Record<string, string> = {
  concluida_com_habite_se: 'Concluída com Habite-se',
  concluida_sem_habite_se: 'Concluída sem Habite-se',
  em_construcao: 'Em construção',
  iniciar_em_breve: 'Iniciar em breve',
  construida_ha_mais_de_5_anos: 'Construída há mais de 5 anos',
};

export const DESTINACAO_LABEL: Record<string, string> = {
  residencial_unifamiliar: 'Residencial unifamiliar',
  multifamiliar: 'Multifamiliar',
  comercial_salas_lojas: 'Comercial — salas e lojas',
  galpao_industrial: 'Galpão industrial',
  conjunto_habitacional: 'Conjunto habitacional',
  edificio_garagem: 'Edifício garagem',
};

export const CATEGORIA_LABEL: Record<string, string> = {
  obra_nova: 'Obra nova',
  acrescimo: 'Acréscimo',
  reforma: 'Reforma',
  demolicao: 'Demolição',
};

/** Rótulo "UF — Nome do estado" a partir da sigla, com fallback seguro. */
export function estadoLabel(uf: string): string {
  const found = BRAZILIAN_STATES.find((state) => state.uf === uf);
  return found ? `${found.uf} — ${found.nome}` : uf || 'Não informado';
}

/**
 * Renova a cópia das tabelas (VAU por estado e Selic) guardada no bot, a partir dos arquivos do site.
 * Rode na pasta bot-whatsapp:  node scripts/gerar-dados-simulacao.js
 * (O bot já lê as tabelas do site sozinho quando liga; esta cópia só serve de reserva.)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerTabelasDoSite } from '../src/simulacao.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const t = lerTabelasDoSite(join(aqui, '..', '..', 'src', 'data'));
const conteudo = `/**
 * CÓPIA de reserva das tabelas do site (src/data/vauEstadual.ts e selicMensal.ts).
 * GERADO por scripts/gerar-dados-simulacao.js em ${new Date().toISOString().slice(0, 10)}: não edite à mão.
 */
export const VAU_COMPETENCIA = ${JSON.stringify(t.VAU_COMPETENCIA)};
export const VAU_ESTADUAL = ${JSON.stringify(t.VAU_ESTADUAL, null, 1)};
export const SELIC_MENSAL = ${JSON.stringify(t.SELIC_MENSAL)};
`;
writeFileSync(join(aqui, '..', 'src', 'simulacao-dados.js'), conteudo);
console.log(`Pronto: VAU de ${t.VAU_COMPETENCIA}, ${Object.keys(t.VAU_ESTADUAL).length} estados, ${Object.keys(t.SELIC_MENSAL).length} meses de Selic.`);

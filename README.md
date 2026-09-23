# Gabriel Zaneloti — INSS de Obras

Landing page profissional para geração de leads, com calculadora/simulador de INSS de obra em 3 etapas, integração com WhatsApp e camada de captura de leads pronta para conectar a um backend.

Stack: **React 18 + TypeScript + Vite + Tailwind CSS**.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

Build de produção:

```bash
npm run build
npm run preview
```

> **Nota sobre este projeto**: todo o código foi escrito à mão neste ambiente, que teve o acesso ao registro do npm bloqueado pela política de rede da organização — por isso não foi possível rodar `npm install`/`npm run build` aqui dentro para gerar um preview ao vivo. Em compensação, cada arquivo `.ts`/`.tsx` foi validado individualmente com o parser do esbuild e o projeto inteiro foi compilado de ponta a ponta (resolução de todos os imports, JSX, hooks) sem erros. No seu computador, com internet normal, `npm install && npm run dev` deve funcionar diretamente.

## Estrutura do projeto

```
src/
  types/         Interfaces e tipos (CalculatorData, Lead, INSSResult...)
  data/          Conteúdo real do site de referência (serviços, FAQ, benefícios, estados, etapas)
  services/      Lógica de negócio isolada dos componentes
    calculateINSS.ts        Motor de cálculo do simulador PÚBLICO (MOCK — ver seção abaixo)
    calculateFatorAjuste.ts Motor de cálculo REAL do Fator de Ajuste — ferramenta INTERNA (ver seção própria)
    whatsapp.ts         Geração da mensagem/URL do WhatsApp
    leadService.ts       Camada de persistência de leads (hoje: localStorage)
    analytics.ts          Disparo de eventos para GA4 / Google Ads / Meta Pixel
  data/
    selicMensal.ts     Tabela de taxas Selic mensais (Bacen) + cálculo da Selic acumulada (Art. 31 da IN 2021/2021)
  types/
    fatorAjuste.ts     Tipos do motor de cálculo interno (FatorAjusteInput/Result)
  utils/         Validação e formatação (moeda, datas, máscara de telefone, percentual)
  hooks/         useCalculatorForm (estado central da calculadora), useCountUp (animação de números)
  calculo/       Página interna `/calculo.html` — formulário, relatório e motor do Fator de Ajuste
    App.tsx, PasscodeGate.tsx, CalculoForm.tsx, CalculoReport.tsx, main.tsx
  components/
    layout/      Header, Footer
    calculator/  Calculator, ProgressBar, LeadForm, ObraDataStep, AreasStep, ResultCard, CalculatorStep
    ui/          Componentes visuais reutilizáveis (Container, SectionHeading, ServiceIcon)
    Hero, Services, ServiceCard, HowItWorks, Authority, About, Benefits, FAQ, CTA, WhatsAppButton
```

## Simulador público (site) vs. calculadora interna (`/calculo.html`)

O projeto tem dois motores de cálculo, que hoje usam as **mesmas mecânicas oficiais** da IN RFB nº 2021/2021, mas para propósitos diferentes:

- **`src/services/calculateINSS.ts`** — usado pelo simulador de 3 etapas do site público. Estima a RMT (100% SERO) sozinho, a partir da área/destinação/tipo/categoria da obra e da tabela oficial de **VAU por estado** (`src/data/vauEstadual.ts`), reproduzindo a "aferição indireta" da Receita (`src/services/calculateRMTIndireta.ts`) — e então aplica o mesmo motor de Fator de Ajuste abaixo. Ainda é rotulado como **estimativa** (`isEstimativaProvisoria: true`) porque simplifica alguns pontos que o formulário público não pergunta (ver comentário no topo do arquivo) — não substitui a apuração oficial.
- **`src/services/calculateFatorAjuste.ts`** — o motor do Fator de Ajuste (Art. 33 da IN RFB nº 2021/2021: Selic, CPP, multa, mora, MAED), usado tanto pelo simulador público quanto pela página interna `/calculo.html` (ver seção abaixo). Foi validado, mês a mês e no total, contra 4 relatórios reais que você forneceu — bateu exatamente (até o centavo) em todos os valores, exceto o parcelamento (estimativa simplificada, sem os juros próprios do parcelamento da Receita).

A diferença entre os dois "motores" é só a **origem da RMT**: no simulador público ela é estimada a partir da área (você não digita nada a mais); na calculadora interna, você já informa a RMT real que apurou.

### Tabela VAU por estado (`src/data/vauEstadual.ts`)

O VAU é o índice oficial (R$/m², por estado e destinação) que a Receita usa para estimar o custo da obra a partir da área — é a mesma tabela que aparece dentro do próprio Sero (não uma estimativa via CUB/Sinduscon). Como esse índice muda todo mês, atualize-o assim:

1. Entre no e-CAC (https://cav.receita.fazenda.gov.br) com sua conta gov.br.
2. Vá em **Declarações e Demonstrativos → Acessar o Sero** → menu **Aferições → Consultar Tabela VAU**.
3. Escolha o ano atual e cada estado, clique em **Buscar** — a tela traz todos os meses já publicados no ano; use a linha do mês mais recente.
4. Atualize os valores em `src/data/vauEstadual.ts` (e o `VAU_COMPETENCIA` no topo do arquivo) — o resto do sistema usa isso automaticamente.

### Se quiser ajustar a estimativa do site público

Edite `src/services/calculateINSS.ts` (orquestra tudo) ou `src/services/calculateRMTIndireta.ts` (a fórmula da RMT em si), mantendo a assinatura de `calculateINSS`:

```ts
function calculateINSS(data: CalculatorData): INSSResult
```

Nenhum outro arquivo precisa mudar — formulário, resultado, WhatsApp, leads e analytics continuam funcionando normalmente. Se os dados informados estiverem fora do que o motor sabe tratar (ex: obra iniciada antes de jan/2021, fora da tabela de Selic), a função lança um erro tratado — a tela mostra uma mensagem pedindo para falar direto no WhatsApp, em vez de travar.

## Calculadora interna do Fator de Ajuste (`/calculo.html`)

Página separada do site público (não tem link em nenhum lugar do site nem é indexada — tem `<meta name="robots" content="noindex, nofollow">`), para você mesmo usar.

**Como usar:** depois do deploy, acesse `https://SEU-SITE.vercel.app/calculo.html`. Preencha:

- **RMT (100% SERO)** — você calcula e informa manualmente (depende das tabelas CUB/VAU, fora do escopo desta ferramenta).
- **Área da obra** — define automaticamente o Fator de Ajuste (50% até 350 m², 70% acima).
- **Datas de início/fim** — competências da DCTFWeb.
- **Data do cálculo** — usada para juros/mora até hoje.
- **Responsável (PF/PJ)** — define a parcela mínima do parcelamento estimado (PF R$200, PJ R$500, até 60x).
- **Honorários** (opcional) — você informa manualmente; a ferramenta só subtrai do valor da redução para mostrar a redução líquida.

O relatório mostra a tabela mês a mês (REM.ATUAL, REM.ORIG, CPP, MULTA, SELIC, MORA, MAED, TOTAL), o comparativo com/sem Fator de Ajuste e o parcelamento estimado.

**Senha de acesso (opcional, não é segurança de verdade):** defina `VITE_CALCULO_PASSCODE` nas variáveis de ambiente do Vercel para pedir uma senha simples antes de mostrar a página — serve só para evitar que alguém tropece na página por acaso. Se não definir nada, a página fica aberta para quem tiver o link. Para proteção de verdade, use a **Proteção por Senha** do próprio Vercel (Project Settings → Deployment Protection, disponível nos planos pagos).

**Manutenção da tabela de Selic — agora automática:** `src/data/selicMensal.ts` tem as taxas mensais do Bacen (série SGS 4390). Um workflow do GitHub Actions (`.github/workflows/update-selic.yml`, script `scripts/update-selic.mjs`) confere a API do Bacen alguns dias por mês e, assim que a Receita/Bacen divulga a Selic de um mês novo, acrescenta a linha sozinho e publica direto no `main` — o deploy do Vercel acontece automaticamente depois, como em qualquer outro commit. Não precisa mais editar esse arquivo à mão nem pedir pra ninguém atualizar. Se faltar um mês na tabela para uma competência que você tentar calcular (ex: o workflow ficou fora do ar por algum motivo), a ferramenta mostra um erro em vez de calcular errado — nesse caso, rode `node scripts/update-selic.mjs` manualmente ou acesse Actions → "Atualiza Selic mensal" → Run workflow no GitHub.

**Para essa automação funcionar**, o repositório no GitHub precisa permitir que as Actions escrevam de volta nele: Settings → Actions → General → Workflow permissions → marque **"Read and write permissions"** e salve. Isso só precisa ser feito uma vez.

## Conectando um backend real para os leads

Hoje os leads são salvos no `localStorage` do navegador (`src/services/leadService.ts`), como fallback funcional enquanto não há backend definido.

Para conectar Supabase, uma API própria, um CRM ou um webhook:

1. Implemente a interface `LeadStorageAdapter` (`create`/`list`) em uma nova classe (há um esqueleto comentado de exemplo com `fetch()` no próprio arquivo).
2. Troque a instância `activeAdapter` no final do arquivo pela nova implementação.

Nenhum componente React precisa ser alterado.

## Analytics (GA4 / Google Ads / Meta Pixel / Google Tag Manager)

**GA4 / Google Ads / Meta Pixel** — nenhum ID fictício foi inserido no código. Para ativar:

1. No painel do Vercel, vá em **Project Settings → Environment Variables**.
2. Adicione as variáveis que você usa: `VITE_GA4_MEASUREMENT_ID` (GA4), `VITE_GOOGLE_ADS_CONVERSION_ID` (pixel/conversão do Google Ads — o gtag.js é compartilhado entre GA4 e Google Ads) e/ou `VITE_META_PIXEL_ID` (Meta/Facebook Pixel).
3. Clique em **Redeploy** (ou faça um novo commit) para a variável entrar em vigor.

Você não precisa editar `index.html` nem adicionar nenhum script manualmente para essas três: `src/services/analytics.ts` já injeta o gtag.js e/ou o Meta Pixel automaticamente assim que a respectiva variável de ambiente existe — se a variável não estiver definida, o script correspondente simplesmente não carrega.

**Google Tag Manager** — funciona diferente das três acima: em vez de variável de ambiente, o snippet oficial do Google (o mesmo que o painel do GTM manda "colar em todas as páginas do seu site") está fixo diretamente no `<head>` e logo após a abertura do `<body>` de cada arquivo `.html` do projeto (`index.html`, `calculo.html`, `crm.html`, `privacidade.html` e `termos.html`) — container atual: `GTM-NFSNQBZL`. Para trocar de container no futuro, é só buscar por `GTM-` nesses 5 arquivos e substituir o ID nos dois lugares de cada um (a versão do `<head>` e a `src` do `<iframe>` do `<noscript>`).

Todos os eventos disparados pelo site (via `trackEvent()`, listados abaixo) já são enviados automaticamente ao `dataLayer` do Tag Manager — dá para criar tags e gatilhos novos direto no painel do GTM, filtrando pelo nome do evento, sem precisar mexer em código.

Os eventos já disparados pelo site, via `trackEvent()`:

- `click_simular`
- `calculator_started`
- `calculator_step_1_completed`
- `calculator_step_2_completed`
- `calculator_completed`
- `whatsapp_clicked`
- `faq_opened`
- `pdf_baixado`
- `guia_caminho_baixado`

## PDF de diagnóstico

Dois PDFs diferentes, gerados com `pdf-lib` (biblioteca pura JS/TS, sem dependência nativa — funciona tanto no navegador quanto no servidor):

- **Público** (`src/services/pdfReport.ts`) — botão "Baixar diagnóstico em PDF" no resultado da calculadora (`ResultCard.tsx`). Gerado no navegador do próprio lead, com o resumo da simulação. **Nunca contém honorários** — só lê os campos públicos de `INSSResult`, nunca `result.detalheInterno` (ver aviso no topo do arquivo).
- **Interno** (função `buildInternalPdfBase64` em `api/notify-lead.js`) — o mesmo detalhamento mensal (Fator de Ajuste, honorários, redução líquida, parcelamento) que já ia no corpo do e-mail, agora também anexado como arquivo `.pdf` ao e-mail que o Gabriel recebe — para guardar junto com a documentação do cliente e usar nos lançamentos mensais, sem precisar copiar do corpo do e-mail. Se a geração falhar por qualquer motivo, o e-mail é enviado normalmente, só sem o anexo (nunca trava o envio).

## Guia gratuito (lead magnet)

Seção `GuiaCaminho.tsx` (entre "Urgência" e "FAQ" na página inicial): captura nome + e-mail + WhatsApp de visitantes que ainda não estão prontos para preencher a calculadora completa, em troca do PDF estático `public/guia-caminho-regularizacao.pdf` ("O caminho da regularização da sua obra" — cronograma completo do processo, do levantamento até a CND/CPEND, com o que é feito pelo Gabriel, o que fica com o cliente e os documentos necessários em cada etapa).

- O download do PDF acontece imediatamente ao enviar o formulário (`src/services/guiaLeadService.ts`) — nunca espera a rede.
- Em paralelo, a função serverless `/api/notify-guia-lead.js` grava o contato na tabela `guia_leads` do Supabase (separada de `leads`, já que ainda não é uma simulação completa) e avisa o Gabriel por e-mail — mesmas variáveis de ambiente já usadas por `/api/notify-lead.js` (`RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- SQL da tabela `guia_leads` também está em `supabase_setup.sql`.
- Para atualizar o conteúdo do PDF no futuro, edite o texto direto no arquivo estático em `public/` (ele não é gerado em tempo de execução, ao contrário dos PDFs de diagnóstico).
- **E-mail capturado para remarketing**: o campo de e-mail existe especificamente para permitir campanhas de remarketing (Meta Ads Custom Audiences, Google Ads Customer Match). A lista completa (nome, e-mail, WhatsApp) fica disponível pra exportar em CSV na aba "Guia" do CRM interno (ver seção abaixo).

## Conteúdo

Todo o conteúdo institucional (textos, serviços, FAQ, número de economia acumulada, dados de contato) foi extraído do site atual, https://www.gabrielzaneloti.com.br/, e reorganizado em uma estrutura mais moderna. Nenhuma informação sobre certificações, clientes ou depoimentos foi inventada. A página `/sobre.html` reaproveita apenas conteúdo já existente no site (nenhuma credencial nova foi inventada) — envie mais detalhes reais (formação, tempo de atuação, registro profissional) se quiser enriquecê-la.

## CRM interno (`/crm.html`)

Página separada do site público (não linkada, `noindex`), protegida por login (Supabase Auth — e-mail/senha, criado manualmente em Authentication → Users no painel do Supabase). Mostra:

- **Quadro** — os leads em colunas por etapa do funil: `Novo → Contatado → Proposta enviada → Decidindo → Fechado / Perdido`. Clique num lead pra ver os detalhes da simulação, mudar a etapa, escrever anotações e (quando fechado) registrar o valor fechado.
- **Dashboard** — funil de conversão, leads por mês, por estado e por tipo de obra, taxa de conversão e valor total fechado.
- **Guia** (`GuiaLeadsView.tsx`) — planilha com nome, e-mail, WhatsApp e data de todo mundo que baixou o guia gratuito (tabela `guia_leads`, independente do funil de `leads`). Tem um botão "Baixar CSV" que exporta a lista inteira pronta pra subir num sistema de remarketing (Meta Ads Custom Audiences, Google Ads Customer Match).

**Como funciona por baixo:** o site público continua gravando cada simulação na tabela `leads` do Supabase através da função serverless `/api/notify-lead.js` (chave `service_role`, ignora RLS). O CRM lê e atualiza essa mesma tabela pelo navegador, usando a chave `anon` — protegida por Row Level Security (só usuário autenticado lê/edita) e pelo login do Supabase Auth.

**Configuração** (variáveis de ambiente, no Vercel e/ou `.env` local):

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — seguras para o navegador (protegidas por RLS + login).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — já existiam (usadas por `/api/notify-lead.js`).

O SQL de criação da tabela `leads` (colunas, índices, trigger de `updated_at` e as policies de RLS) está documentado em `supabase_setup.sql`, na raiz do projeto — rode uma vez no SQL Editor do Supabase.

## Pendências propositalmente deixadas para você

- [x] Fórmula real do Fator de Ajuste — implementada em `/calculo.html` (ferramenta interna); o simulador público continua com a estimativa (mock), de propósito
- [x] Fotografia profissional de Gabriel Zaneloti (seção "Sobre")
- [ ] Política de Privacidade e Termos de Uso (links já reservados no rodapé)
- [x] Backend/CRM real para leads — Supabase + `/crm.html` (quadro por etapa do funil + dashboard com gráficos)
- [ ] IDs de GA4 / Google Ads / Meta Pixel / Google Tag Manager (variáveis de ambiente no Vercel)
- [ ] Domínio e deploy (Vercel, Netlify ou similar)
- [ ] Depoimentos reais de clientes (opcional) — envie 2-3 casos reais (mesmo anonimizados) se quiser incluir uma seção de prova social
- [ ] Mais detalhes reais para `/sobre.html` (formação, tempo de atuação, registro profissional) — a página já está no ar com o conteúdo real que já existia no site

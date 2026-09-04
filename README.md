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

**Manutenção da tabela de Selic:** `src/data/selicMensal.ts` tem as taxas mensais do Bacen até 08/2026. Quando esse período se esgotar, adicione os meses seguintes no mesmo objeto `SELIC_MENSAL` (formato `"AAAA-MM": taxa_do_mes_em_percentual`), consultando https://www.bcb.gov.br/controleinflacao/historicotaxasjuros. Se faltar um mês na tabela para uma competência que você tentar calcular, a ferramenta mostra um erro em vez de calcular errado.

## Conectando um backend real para os leads

Hoje os leads são salvos no `localStorage` do navegador (`src/services/leadService.ts`), como fallback funcional enquanto não há backend definido.

Para conectar Supabase, uma API própria, um CRM ou um webhook:

1. Implemente a interface `LeadStorageAdapter` (`create`/`list`) em uma nova classe (há um esqueleto comentado de exemplo com `fetch()` no próprio arquivo).
2. Troque a instância `activeAdapter` no final do arquivo pela nova implementação.

Nenhum componente React precisa ser alterado.

## Analytics (GA4 / Google Ads / Meta Pixel)

Nenhum ID fictício foi inserido no código. Para ativar:

1. No painel do Vercel, vá em **Project Settings → Environment Variables**.
2. Adicione as variáveis que você usa: `VITE_GA4_MEASUREMENT_ID` (GA4), `VITE_GOOGLE_ADS_CONVERSION_ID` (pixel/conversão do Google Ads — o gtag.js é compartilhado entre GA4 e Google Ads) e/ou `VITE_META_PIXEL_ID` (Meta/Facebook Pixel).
3. Clique em **Redeploy** (ou faça um novo commit) para a variável entrar em vigor.

Você não precisa editar `index.html` nem adicionar nenhum script manualmente: `src/services/analytics.ts` já injeta o gtag.js e/ou o Meta Pixel automaticamente assim que a respectiva variável de ambiente existe — se a variável não estiver definida, o script correspondente simplesmente não carrega.

Os eventos já disparados pelo site, via `trackEvent()`:

- `click_simular`
- `calculator_started`
- `calculator_step_1_completed`
- `calculator_step_2_completed`
- `calculator_completed`
- `whatsapp_clicked`
- `faq_opened`

## Conteúdo

Todo o conteúdo institucional (textos, serviços, FAQ, número de economia acumulada, dados de contato) foi extraído do site atual, https://www.gabrielzaneloti.com.br/, e reorganizado em uma estrutura mais moderna. Nenhuma informação sobre certificações, clientes ou depoimentos foi inventada — os espaços para fotografia profissional, política de privacidade e termos de uso estão reservados no layout, prontos para receber o conteúdo real quando disponível.

## Pendências propositalmente deixadas para você

- [x] Fórmula real do Fator de Ajuste — implementada em `/calculo.html` (ferramenta interna); o simulador público continua com a estimativa (mock), de propósito
- [ ] Fotografia profissional de Gabriel Zaneloti (seção "Sobre")
- [ ] Política de Privacidade e Termos de Uso (links já reservados no rodapé)
- [ ] Backend/CRM real para leads (Supabase, API própria, webhook...)
- [ ] IDs de GA4 / Google Ads / Meta Pixel (variáveis de ambiente no Vercel)
- [ ] Domínio e deploy (Vercel, Netlify ou similar)

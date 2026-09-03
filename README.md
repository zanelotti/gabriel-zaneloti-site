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
    calculateINSS.ts   Motor de cálculo (MOCK — ver seção abaixo)
    whatsapp.ts         Geração da mensagem/URL do WhatsApp
    leadService.ts       Camada de persistência de leads (hoje: localStorage)
    analytics.ts          Disparo de eventos para GA4 / Google Ads / Meta Pixel
  utils/         Validação e formatação (moeda, datas, máscara de telefone)
  hooks/         useCalculatorForm (estado central da calculadora), useCountUp (animação de números)
  components/
    layout/      Header, Footer
    calculator/  Calculator, ProgressBar, LeadForm, ObraDataStep, AreasStep, ResultCard, CalculatorStep
    ui/          Componentes visuais reutilizáveis (Container, SectionHeading, ServiceIcon)
    Hero, Services, ServiceCard, HowItWorks, Authority, About, Benefits, FAQ, CTA, WhatsAppButton
```

## Substituindo o motor de cálculo real

O arquivo `src/services/calculateINSS.ts` contém **uma estimativa provisória (mock)**, claramente identificada como tal — não é a fórmula oficial do INSS de obra.

Quando você tiver as regras exatas de cálculo, edite **apenas** o corpo da função `calculateINSS()`, mantendo a mesma assinatura:

```ts
function calculateINSS(data: CalculatorData): INSSResult
```

Nenhum outro arquivo precisa mudar — formulário, resultado, WhatsApp, leads e analytics continuam funcionando normalmente.

## Conectando um backend real para os leads

Hoje os leads são salvos no `localStorage` do navegador (`src/services/leadService.ts`), como fallback funcional enquanto não há backend definido.

Para conectar Supabase, uma API própria, um CRM ou um webhook:

1. Implemente a interface `LeadStorageAdapter` (`create`/`list`) em uma nova classe (há um esqueleto comentado de exemplo com `fetch()` no próprio arquivo).
2. Troque a instância `activeAdapter` no final do arquivo pela nova implementação.

Nenhum componente React precisa ser alterado.

## Analytics (GA4 / Google Ads / Meta Pixel)

Nenhum ID fictício foi inserido no código. Para ativar:

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis que você usa (`VITE_GA4_MEASUREMENT_ID`, `VITE_GOOGLE_ADS_CONVERSION_ID`, `VITE_META_PIXEL_ID`).
3. Adicione os scripts oficiais de carregamento do GA4/gtag.js e/ou do Meta Pixel no `index.html` (ou via Google Tag Manager), conforme a documentação de cada plataforma.

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

- [ ] Fórmula oficial de cálculo do INSS de obra (substituir o mock)
- [ ] Fotografia profissional de Gabriel Zaneloti (seção "Sobre")
- [ ] Política de Privacidade e Termos de Uso (links já reservados no rodapé)
- [ ] Backend/CRM real para leads (Supabase, API própria, webhook...)
- [ ] IDs de GA4 / Google Ads / Meta Pixel
- [ ] Domínio e deploy (Vercel, Netlify ou similar)

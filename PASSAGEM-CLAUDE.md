# Passagem para o Claude: site, Lia e análises do Gabriel Zaneloti

Atualizado em 25/11/2026. Este arquivo resume tudo o que está montado, para uma conversa nova continuar de onde paramos.
**Não contém senhas nem chaves.**

## 1. Como falar com o Gabriel (obrigatório)

- Ele não é programador. Português simples, **um passo de cada vez**, sem jargão.
- Quando for guiar por um site (Vercel, Anthropic, Contabo, Resend, Supabase...), **peça print da tela** e diga onde clicar a partir do print. As telas mudam; não "chute" nomes de menus.
- **Nunca** digitar senhas ou chaves, nem pedir para ele colar chaves no chat. Chaves vão no arquivo `.env` do computador (ele edita no Bloco de Notas) ou no botão "Trocar chave" do Painel.
- Quando ele pedir uma chave nova, mande-o **colar no `.env` antes de fechar a janela** (a chave só aparece uma vez).

## 2. Regras de negócio

- **Google Ads:** a campanha é do gestor de tráfego. **Só olhar, nunca alterar** (campanha, orçamento, lance, anúncio). Sugestões vão para o Gabriel repassar ao gestor.
- **Não citar o honorário de 12% em anúncios.**
- **Honorário (pessoa física):** 12% da economia estimada. Se 12% der menos de R$ 800, o honorário é **R$ 800 e a Lia diz só o valor** (sem falar em 12%, economia ou "mínimo"). Empresa: R$ 1.000 + 12% da economia conseguida.
- **Formas de pagamento do honorário:** à vista, ou 50% no início e 50% no fim, ou cartão em até 6x sem juros (sobre o valor inteiro).
- **Parcelamento do INSS (até 60x)** só para meses já em atraso; obra em andamento paga mês a mês.
- **Análises de Ads/Clarity:** sempre **só o período desde a última análise**. Histórico em `historico-analises.md` (pasta do site). Acrescentar a análise nova no fim.

## 3. Onde está cada coisa

| Item | Onde |
|---|---|
| Código do site + da Lia | `C:\9 - INSS de obra\gabriel-zaneloti-site` (GitHub `zanelotti/gabriel-zaneloti-site`, publica no Vercel) |
| Lia (bot do WhatsApp) | pasta `bot-whatsapp` do repositório |
| Chaves da Lia | `bot-whatsapp\.env` no computador (copiado para o servidor na reinstalação) |
| Código-fonte do Painel da Lia | `painel-da-lia\PainelDaLia.cs` (+ `lia.ico`) no repositório |
| Histórico das análises | `historico-analises.md` na pasta do site |
| Servidor | Contabo VPS `13.140.223.250`, Ubuntu 24.04, usuário root, só entra por chave SSH (senha desligada), firewall ufw só porta 22 |
| Lia no servidor | `/root/gabriel-zaneloti-site/bot-whatsapp`, serviço systemd `bot-whatsapp` (Node 22), logs no `journalctl -u bot-whatsapp` |

## 4. Como as atualizações chegam ao ar

1. O Claude gera um pacote `atualizacao-lia-vNN.tgz` (caminhos a partir da raiz do repositório) e coloca na pasta **Downloads**.
2. O Gabriel clica em **Instalar atualização** no Painel da Lia. O Painel:
   - abre o pacote mais novo da pasta Downloads dentro do repositório;
   - faz `git add/commit/push` (o Vercel publica o site);
   - empacota `bot-whatsapp` + `src/data`, envia ao servidor, instala e reinicia a Lia;
   - move o pacote para `Downloads\Lia - pacotes instalados`.
3. O Painel instala **um pacote por clique** (sempre o mais novo).

Último pacote gerado: **v30**. Confira em `Downloads` quais ainda não foram instalados (v29: honorário de R$ 800 só pelo valor; v30: itens clicáveis + velocidade).

### Botões do Painel da Lia (versão "organizar")

Verificar agora · Reiniciar · Instalar atualização · Ver últimas mensagens · Desligar · Ligar · Procurar conversa (por telefone) · Trocar chave da API · Configurar acesso (pede a senha do servidor numa janela preta) · Reinstalar a Lia (servidor novo) · Conectar o WhatsApp (QR code) · Organizar o quadro (a Lia lê as conversas e sugere a coluna de cada card; só aplica com "Sim").

Compilar o Painel: `mcs -target:winexe -sdk:4.5 -win32icon:lia.ico -r:System.Windows.Forms.dll -r:System.Drawing.dll -out:"Painel da Lia.exe" PainelDaLia.cs`. O chat não deixa baixar .exe: entregar direto na pasta Downloads.

Se o Painel der "Connection reset" na porta 22: são robôs atacando o SSH; esperar 1 minuto e tentar de novo. (Pendente: instalar proteção tipo fail2ban.)

## 5. A Lia (bot)

- Node + Baileys (WhatsApp) + Claude. Testes: `node test/simulate.js` (167 passando).
- Modo vendas: confirma metragem/prazo → números em 3 mensagens (sem planejamento X; com planejamento Y; "economia de R$ Z (P%)" + 60x se a obra já terminou) → **uma** pergunta sobre a obra → VALOR (como reduz, o que o Gabriel faz, prova) + convite "posso te mostrar o investimento?" → honorário só se perguntarem ou aceitarem → pergunta de fechamento → dados do contrato → passa para o Gabriel.
- Depois de passar para o Gabriel, ou se o Gabriel responder pelo WhatsApp, a Lia fica calada naquela conversa.
- Ignora a saudação automática do WhatsApp Business (não confunde com o Gabriel).
- Lê fotos e PDFs. **Não ouve áudios** (pendente: transcrição).
- Supabase: tabelas `leads`, `bot_conversas`, `bot_mensagens`, `bot_estado`, `bot_config`, etc.

## 6. O site

- Vite + React + TS. Calculadora no topo: obra → tamanho → contato → **depois do contato** mostra "sem planejamento a Receita cobraria cerca de R$ X" e o botão "Ver quanto economizo no WhatsApp" (a economia só vai pelo WhatsApp). "Pessoa Física" já vem marcada.
- Avaliações do Google: quadro próprio, grátis (`src/data/avaliacoes.ts`), passa sozinho a cada 5 s, setas laterais. O Trustindex foi abandonado (plano grátis não funciona fora do WordPress). Avaliação nova no Google: acrescentar no arquivo.
- Perfil do Google aparece como "Zantech soluções integradas" (nota 5,0, 4 avaliações).
- Números do site: R$ 1,09 milhão economizado; redução média 58%; CNPJ 48.449.007/0001-11; sem CREA.
- Scripts de terceiros (GTM, gtag, Clarity) carregam depois da página (`src/services/depoisDeCarregar.ts`).

## 7. Contas para análises (o Gabriel faz o login no navegador do Claude)

- **Google Ads:** conta Google `comercial.mfzeng@gmail.com` → Zantech Soluções Integradas (664-658-8413). Campanha **[Leads-22/09]** (id 24273351306). Conversão "Lead - Simulação concluída". Conta pré-paga via Pix: **ver o saldo** em Faturamento.
- Também dá para ler o Ads pelo conector **Adspirer** (`get_campaign_performance`, customer 6646588413), útil quando o navegador está deslogado.
- **Clarity:** conta `adm.osenhorio@gmail.com`, projeto "Site Gabriel" (zfsbk2oeyv). Funil "Formulário da simulação": calculator_started → step_1 → step_2 → calculator_completed. Etiqueta `origem` (google_ads, google_organico, direto...).

## 8. Segurança (incidente Contabo de 23/11/2026)

- A Contabo avisou que o servidor pode ter sido acessado. Foi **reinstalado do zero**, com chaves novas.
- Chaves atuais (só os nomes): Anthropic "lia-nova"; Resend "lia-e-site-nova"; Supabase secret "lia_e_site_nova". As mesmas do Resend e do Supabase estão no Vercel (variáveis `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Confirmar se já foram apagadas** as antigas: Resend "INSS" e Supabase "default".
- O WhatsApp foi reconectado com QR novo.

## 9. Pendências

1. Confirmar a instalação da v29 e da v30.
2. Confirmar se as chaves antigas (Resend "INSS", Supabase "default") foram apagadas.
3. Saldo do Google Ads: recarregar.
4. Sugerir ao gestor aumentar o orçamento (custo por simulação caiu para ~R$ 11).
5. Lia ouvir áudios (transcrição).
6. Proteção contra robôs no SSH do servidor.
7. Onboarding de clientes (fazer junto uma vez e virar roteiro): precisa saber a pasta dos clientes, o sistema da nota fiscal e o sistema de contratos.
8. A Lia guardar os documentos que o cliente manda no WhatsApp (para o onboarding).
9. Confirmar com o Gabriel a frase do arquivo `conhecimento/03-sobre-o-gabriel.md` ("em um único cliente já economizou mais de R$ 1 milhão"): é verdade ou deveria ser o total?

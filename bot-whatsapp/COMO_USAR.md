# Bot de WhatsApp do Gabriel: como instalar e usar

Este bot aborda sozinho, 24h por dia, cada lead que preenche a calculadora do site. Ele se apresenta pelo nome (padrão: Lia, mude com ASSISTENTE_NOME no .env) como assistente do Gabriel, conversa usando as técnicas do livro, tira dúvidas simples e agenda a consultoria. Quando o assunto é preço, desconto, dúvida técnica ou quando o lead pede uma pessoa, ele passa a conversa para você e avisa por e-mail.

> **Importante:** ele usa o WhatsApp por QR code (a biblioteca Baileys), que **não é a API oficial**. O WhatsApp pode restringir ou banir números que usam automação, inclusive o seu número principal. As proteções do bot reduzem o risco, mas não o eliminam. Você decidiu seguir com o número atual; se um dia quiser reduzir o risco, o mais seguro é um número só para o bot.

## O que você precisa

- Um computador com Windows que fique **ligado e com internet 24h**.
- Node.js (versão LTS): https://nodejs.org
- Uma chave da API da Anthropic (cobrança por uso): https://console.anthropic.com → API Keys (adicione créditos na conta).
- Os dados do Supabase e do Resend que o site já usa no Vercel.

## Passo a passo

### 1. Criar as tabelas no Supabase (uma vez)
Supabase → **SQL Editor** → **New query** → cole o conteúdo do arquivo `supabase_bot.sql` → **Run**.

### 2. Instalar
Dê dois cliques em **`instalar.bat`**. Ele instala o que precisa e abre o arquivo `.env` no Bloco de Notas. Preencha:

- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: as mesmas variáveis do projeto no Vercel (ou Supabase → Project Settings → API).
- `ANTHROPIC_API_KEY`: a chave da Anthropic.
- `RESEND_API_KEY`: a mesma do site (é por ela que o bot te avisa por e-mail).

Salve e feche.

### 3. Fazer o primeiro teste (sem risco para leads reais)
No `.env`, preencha `LISTA_TESTE` com **um número de teste** (DDD + número, por exemplo `11999998888`), de um celular que não seja o seu principal (um amigo, outro chip). Assim o bot só fala com esse número.

Dê dois cliques em **`iniciar.bat`**. Vai aparecer um **QR code**: no celular, abra o WhatsApp → **Configurações → Aparelhos conectados → Conectar um aparelho** e escaneie. Quando aparecer "conectado", preencha a calculadora do site com o número de teste. Em poucos segundos a pessoa de teste recebe a abertura. Responda como se fosse um lead e veja como ele conversa.

Importante: o bot só aborda leads criados **depois** que ele foi ligado pela primeira vez. Contatos antigos nunca recebem mensagem.

### 4. Colocar em produção
Apague o valor de `LISTA_TESTE` no `.env`, salve e reinicie o `iniciar.bat` (feche a janela e abra de novo).

### 5. Deixar o computador sempre ligado
- Dê dois cliques em **`evitar-suspensao.bat`** (impede o Windows de suspender na tomada).
- Para o bot ligar junto com o Windows: aperte `Win + R`, digite `shell:startup`, e coloque ali um atalho do `iniciar.bat`.
- Se o computador desligar ou ficar sem internet, os leads daquele período ficam esperando e recebem a mensagem quando voltar (até 48 horas depois do preenchimento; leads mais antigos não são abordados).

## O que o bot sabe: a pasta `conhecimento`

Tudo que está nos arquivos `.md` e `.txt` da pasta **`conhecimento`** é lido pelo bot ao ligar (parcelamento, serviços incluídos, sua história). Para ensinar algo novo, crie ou edite um arquivo lá, salve e reinicie o bot (feche a janela do `iniciar.bat` e abra de novo). Se a resposta não estiver lá, o bot não inventa: passa a conversa para você. Confira principalmente o arquivo `01-parcelamento.md`, que tem a forma de pagamento dos honorários que o bot vai falar.

## Painel do bot dentro do CRM (aba "Bot")

No CRM (seu site, /crm.html) existe a aba **Bot**, onde você controla tudo sem mexer em arquivos:

- **Painel:** luz de status (funcionando, pausado, WhatsApp desconectado, offline), botão **Ligar/Desligar o bot**, e resultados do período (leads abordados, quantos responderam, consultorias marcadas, quantos passaram para você, custo estimado da API).
- **Conversas:** todas as conversas em formato de chat. Dá para **assumir** uma conversa, **escrever para o lead** (a mensagem sai pelo WhatsApp do bot) e **devolver ao bot**. Quem pediu para parar nunca recebe mensagem.
- **Configurações:** nome da assistente, lista de teste, limite de mensagens, valor mínimo para oferecer reunião, horário de funcionamento (opcional; desligado = 24 h) e câmbio. O bot aplica em até 15 segundos, sem reiniciar.
- **Conhecimento:** edite os textos de parcelamento, serviços etc. O bot passa a usar em até 15 segundos.

Para funcionar, o computador do bot precisa estar ligado com a janela do `iniciar.bat` aberta: o CRM só dá ordens, quem executa é o bot. Se o computador estiver desligado, o painel mostra "Offline" e os comandos ficam esperando (expiram em 10 minutos).

Primeira vez: rode o arquivo `supabase_bot_painel.sql` no Supabase (SQL Editor), depois feche e abra o `iniciar.bat`. A partir daí as configurações do `.env` (nome, limites, LISTA_TESTE) servem só como valor inicial; o que vale é o que está no painel.

## Estratégia de venda (CRM → Bot → Configurações)

Duas opções, trocáveis a qualquer momento (vale em até 15 segundos, sem reiniciar):

- **Vender pela conversa (padrão):** a Lia entende o caso (perguntas calibradas, procura o que realmente importa para a pessoa), passa o máximo de valor do serviço antes de falar de honorário (o que a Receita faz sem planejamento, as frentes de redução que cabem na obra, tudo o que você entrega, o custo de não agir), usa as técnicas do livro (espelho, rótulo, auditoria de acusações, perguntas "como/o que", "isso mesmo", aversão à perda só com fatos reais) e conduz a pessoa até decidir. Quando ela decide contratar, a Lia passa a conversa para você formalizar. A consultoria gratuita vira **plano B**: caso complexo, dúvida que ela não sabe responder, pedido do lead, ou quando ela percebe que a pessoa não vai fechar só pela conversa ("vou pensar" repetido, precisa falar com sócio ou contador, desconfiança, esfriou).
- **Levar para a consultoria:** a Lia entende o caso, passa valor e propõe a consultoria gratuita como próximo passo.

Em qualquer das duas: nada de desconto ou negociação (vai para você), e abaixo da economia mínima configurada ela não oferece reunião.

## Honorários que a Lia informa

Se o lead perguntar quanto custa, a Lia responde com o valor calculado pelo próprio sistema (ela não faz conta):

- **Pessoa física:** 12% da economia estimada pela calculadora. Só quando 12% der menos de R$ 600 o honorário fica em R$ 600, e só nesse caso ela explica o piso. Se 12% der R$ 600 ou mais, ela não fala em mínimo.
- **Empresa (CNPJ):** R$ 1.000 mais 12% sobre a economia que for conseguida (notas de pré-moldado, vinculação de créditos de mão de obra registrada etc.). Ela não cita valor de economia para empresa.
- Desconto, negociação ou outra condição: a Lia passa a conversa para você.
- A trava de segurança bloqueia qualquer outro valor em reais e a palavra "mínimo" fora desses casos.
- O texto do arquivo `01-parcelamento.md` que já está no CRM (aba Conhecimento) pode ainda dizer "nunca em reais fixos". A regra acima vale mais, mas, se quiser, edite essa linha no CRM e **não escreva R$ 600 nem R$ 1.000 no texto de conhecimento** (isso liberaria a Lia a citar esses números para todos).

## Aprendizado automático (aba "Aprendizado" do CRM)

Quando você responde um lead (pelo WhatsApp do celular ou pelo CRM) e a conversa fica parada por cerca de 30 minutos, o bot lê a conversa sozinho e guarda o que você ensinou de **geral**: a dúvida e a sua resposta, reescritas sem nome, valor, cidade ou dado do cliente. Nas próximas conversas, quando um lead perguntar algo parecido, a assistente usa isso para explicar (e diz que você confirma no caso dele).

Travas de segurança, tudo automático:

- Só aprende das mensagens **suas**, nunca do lead nem do próprio bot.
- Descarta o que for específico de uma obra, preço, honorário, desconto ou promessa.
- Descarta qualquer item com telefone, e-mail, CPF/CNPJ/CNO, link, valor em R$, nome do cliente ou palavras proibidas.
- Não guarda duas vezes a mesma dúvida.
- O aprendizado é só complemento: as regras do negócio e a aba **Conhecimento** sempre valem mais.
- Na aba **Aprendizado** você vê tudo o que foi aprendido e pode corrigir o texto, **desativar** (o bot para de usar) ou **apagar**. Há também a chave para ligar/desligar o aprendizado inteiro.
- Custa uma chamada curta à API por conversa analisada (centavos).

Para funcionar, rode de novo o `supabase_bot_painel.sql` no Supabase (é seguro rodar mais de uma vez) e reinicie o `iniciar.bat`.

## Documentos grandes: a pasta `documentos`

Para normativa, manuais e outros arquivos grandes (por exemplo a IN RFB 2.021/2021 e o Manual do SERO), use a pasta **`documentos`** (dentro de `bot-whatsapp`). Copie para lá os arquivos em PDF, Word (.docx) ou .txt. Depois feche a janela do bot e abra o `iniciar.bat` de novo.

O bot não lê o documento inteiro a cada conversa: quando o lead faz uma pergunta, ele procura só os trechos relacionados e usa para responder em linguagem simples. Na primeira vez, arquivos grandes levam alguns minutos para serem lidos (aparece "lendo..." na tela); depois fica rápido. PDF escaneado (foto de página) não tem texto: nesse caso a tela avisa e você precisa de uma versão em texto. Se a norma não responder com segurança, o bot passa a conversa para você. Importante: se você trocar de versão da norma, tire a antiga da pasta para o bot não misturar as duas.

Regra prática: coisas curtas e suas (preço, forma de pagamento, como você trabalha) vão na pasta `conhecimento`; textos longos oficiais vão na pasta `documentos`.

## No dia a dia

- **Assumir uma conversa:** é só responder pelo seu WhatsApp no celular. O bot percebe e se cala de vez naquela conversa.
- **Depois que o bot passa para você:** você recebe o e-mail "Passou para você", mas o bot continua disponível para dúvidas simples do lead (como funciona, documentos, parcelamento) até você responder. Ele não volta ao assunto que passou (preço em reais, desconto etc.). Se o lead fizer outra pergunta que o bot não sabe, ele avisa que você responde e você recebe o e-mail "Lead com nova dúvida para você" (no máximo um a cada 30 minutos por conversa).
- **Parar tudo na hora:** crie um arquivo de texto chamado **`PARAR.txt`** nesta pasta. Para voltar, apague o arquivo.
- **Avisos por e-mail:** só quando você precisa agir: o bot passou a conversa para você, chegou áudio ou arquivo, não foi possível contatar um lead ou algo deu errado.
- **Quadro (funil) do CRM:** o bot move os cards sozinho, sempre para a frente, e escreve uma nota em cada passo: abertura enviada = **Contatado**; falou os honorários = **Proposta enviada**; lead demonstrou interesse/pediu o contrato = **Decidindo**; consultoria marcada = **Agendamento**; sem resposta em 24h = **Sem resposta** (volta para Contatado quando o lead responde); recusou ou pediu para parar = **Perdido**. O bot nunca mexe em card **Fechado** ou **Perdido** e nunca puxa para trás um card que você arrastou à mão. Para ligar a coluna Agendamento, rode o `supabase_bot_painel.sql` de novo no Supabase.

## Para fechar mais contratos (mensagens automáticas)
- **Acompanhamento de quem some:** se o bot foi o último a falar e o lead fica em silêncio, o bot manda uma mensagem curta depois de ~1 dia, ~3 dias e ~7 dias (a última pergunta se o lead desistiu, e depois disso ele para). Só entre 8h e 20h, no máximo 5 por rodada. Não insiste com quem pediu para parar, já agendou, fechou, perdeu ou está esperando você. Quando o lead responde, a contagem recomeça. Liga/desliga no CRM em **Bot → Configurações → Mensagens automáticas**.
- **Lembretes da consultoria:** 1 dia e 1 hora antes, para quem agendou e já conversa com o bot. Na aba **Agenda** do CRM, marque **Realizado** depois da consultoria (o bot manda "foi um prazer" com os dados do contrato: nome completo, CPF, endereço e e-mail) ou **Não compareceu** (o bot oferece um novo horário). Sem marcar, ele não manda essas duas.
- **Valor antes do preço:** quando fala dos honorários, o bot mostra a conta completa: quanto o lead economiza, quanto paga e quanto sobra no bolso, lembrando do parcelamento.
- **Depoimentos reais:** já cadastrei na Base de conhecimento (arquivo **06-casos-de-sucesso**) 5 feedbacks que clientes mandaram para você, sem nomes. O bot conta UM quando o lead hesita ou acha caro, nunca cita nome e nunca promete o mesmo resultado. Para acrescentar mais, edite esse arquivo no CRM (Bot → Base de conhecimento).
- **Lead grande:** quando um lead com economia estimada acima do valor de "economia mínima para reunião" responde (ou some), você recebe um e-mail "Lead grande respondeu / sem resposta": é a hora de mandar um áudio de 1 minuto ou ligar.
- **Motivo da perda:** ao marcar um lead como Perdido o bot já registra o motivo quando sabe (achou caro, pediu para parar...). Você escolhe ou corrige no card, e o **Dashboard** mostra "Por que os leads são perdidos".

## O que o bot nunca faz

- Fala com quem não preencheu a calculadora.
- Cita valores que o site não mostrou ao lead, ou valor de economia para pessoa jurídica.
- Diz "só paga se economizar", "risco zero", garante resultado, fala de valor mínimo de honorário fora dos casos abaixo ou usa as palavras "legal", "jurídico", "direito", "advogado". Se o Claude escrever algo assim, a mensagem é bloqueada e reescrita; se não conseguir, o bot passa a conversa para você.
- Dá desconto ou negocia o percentual (12% sobre a economia comprovada).
- Oferece reunião quando a economia estimada é menor que o valor definido em `ECONOMIA_MIN_PARA_REUNIAO` (padrão R$ 5.000): nesses casos passa para você conversar por texto.
- Fala de honorário por conta própria em lead de valor alto (honorário a partir de `HONORARIO_ALTO`, padrão R$ 1.000): nesses casos só responde sobre honorário se a pessoa perguntar, e já na 2ª ou 3ª resposta convida para uma conversa rápida com você. Em lead comum, só fala do honorário depois de 3 mensagens da pessoa ou se ela perguntar. Se o Claude tentar antes, a mensagem é bloqueada e reescrita.
- Passa a conversa para você nas duas primeiras respostas do lead por pergunta geral ("como funciona?"): nesses casos ele mesmo explica. Só passa cedo se a pessoa pedir desconto ou uma pessoa, estiver irritada, mandar documentos ou áudios, quiser contratar ou aceitar a ligação rápida.
- Continua depois que o lead pede para parar.

## Problemas comuns

- **"Faltam variáveis no arquivo .env":** preencha o que a mensagem lista.
- **QR code não aparece ou expirou:** feche e abra o `iniciar.bat` de novo.
- **"A sessão foi desconectada pelo celular":** apague a pasta `auth` e abra o `iniciar.bat` para ler um novo QR code.
- **O bot não responde a um lead:** confira se o status dele ainda era "novo" quando preencheu e se não existe um arquivo `PARAR.txt`.
- **Erro de instalação:** copie a mensagem e me envie.

## Segurança

- A pasta `auth` guarda a sessão do seu WhatsApp e o `.env` guarda chaves secretas. Os dois já estão no `.gitignore`, então **não vão para o GitHub**. Nunca compartilhe esses arquivos.
- O bot não abre nenhuma porta na internet: ele só faz conexões de saída (Supabase, WhatsApp, Anthropic, site).

## Limitações atuais

- Foi testado por simulação (117 testes automáticos com WhatsApp, Supabase e Claude simulados). A conexão real com o WhatsApp só pode ser validada no primeiro teste com o QR code, por isso o passo 3 é importante.
- Áudios e imagens do lead não são lidos: o bot pede que escreva e te avisa.
- Não é feito para contatos em grupo.

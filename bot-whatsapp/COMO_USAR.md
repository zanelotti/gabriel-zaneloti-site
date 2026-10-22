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

## No dia a dia

- **Assumir uma conversa:** é só responder pelo seu WhatsApp no celular. O bot percebe e se cala naquela conversa.
- **Parar tudo na hora:** crie um arquivo de texto chamado **`PARAR.txt`** nesta pasta. Para voltar, apague o arquivo.
- **Avisos por e-mail:** só quando você precisa agir: o bot passou a conversa para você, chegou áudio ou arquivo, não foi possível contatar um lead ou algo deu errado.
- **Funil:** o bot atualiza o status do lead no seu CRM (contatado, decidindo, perdido) e escreve uma nota em cada passo.

## O que o bot nunca faz

- Fala com quem não preencheu a calculadora.
- Cita valores que o site não mostrou ao lead, ou valor de economia para pessoa jurídica.
- Diz "só paga se economizar", "risco zero", garante resultado, fala de valor mínimo ou usa as palavras "legal", "jurídico", "direito", "advogado". Se o Claude escrever algo assim, a mensagem é bloqueada e reescrita; se não conseguir, o bot passa a conversa para você.
- Dá desconto ou negocia o percentual (12% sobre a economia comprovada).
- Oferece reunião quando a economia estimada é menor que o valor definido em `ECONOMIA_MIN_PARA_REUNIAO` (padrão R$ 5.000): nesses casos passa para você conversar por texto.
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

- Foi testado por simulação (27 testes automáticos com WhatsApp, Supabase e Claude simulados). A conexão real com o WhatsApp só pode ser validada no primeiro teste com o QR code, por isso o passo 3 é importante.
- Áudios e imagens do lead não são lidos: o bot pede que escreva e te avisa.
- Não é feito para contatos em grupo.

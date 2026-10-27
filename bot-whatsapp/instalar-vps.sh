#!/usr/bin/env bash
# ============================================================================
#  Instalador do bot de WhatsApp na VPS (Ubuntu 22.04, Oracle Cloud).
#  Rode DENTRO da pasta do bot (a pasta "bot-whatsapp" que você enviou):
#
#     bash instalar-vps.sh              -> instala tudo (Node 20, memória extra, pm2, dependências)
#     bash instalar-vps.sh iniciar      -> liga o bot em segundo plano e faz ele voltar sozinho se a VPS reiniciar
#     bash instalar-vps.sh atualizar    -> depois de enviar arquivos novos: atualiza e reinicia o bot
#     bash instalar-vps.sh status       -> mostra se o bot está vivo e as últimas linhas do log
#
#  Pode rodar de novo sem medo: o script pula o que já está feito.
# ============================================================================
set -euo pipefail

PASTA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PASTA"
NOME="bot"

verde() { printf '\n\033[1;32m%s\033[0m\n' "$*"; }
aviso() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
erro()  { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

precisa_do_basico() {
  [ -f package.json ] || erro "Não achei o package.json aqui. Entre na pasta do bot (cd ~/bot-whatsapp) e rode de novo."
  [ -f src/index.js ] || erro "Não achei src/index.js. Esta não parece ser a pasta do bot."
  [ -f .env ] || erro "Não achei o arquivo .env (as chaves do bot). Ele precisa estar nesta pasta, igual ao do seu computador."
}

instalar() {
  precisa_do_basico

  verde "1/5  Ajustando o relógio para o horário de Brasília"
  sudo timedatectl set-timezone America/Sao_Paulo

  verde "2/5  Criando memória extra (swap de 2 GB), para a VPS pequena não travar"
  if swapon --show | grep -q .; then
    echo "Já existe memória extra. Pulando."
  else
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null
    sudo swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi

  verde "3/5  Instalando o Node 20"
  if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then
    echo "Node $(node -v) já instalado. Pulando."
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  verde "4/5  Instalando o pm2 (mantém o bot ligado e reinicia se cair)"
  command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2

  verde "5/5  Instalando as peças do bot (pode levar alguns minutos)"
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

  verde "Pronto! Instalação concluída."
  if [ -d auth ] && [ -n "$(ls -A auth 2>/dev/null)" ]; then
    echo "O WhatsApp já está conectado nesta VPS. Para ligar o bot de vez, rode:  bash instalar-vps.sh iniciar"
  else
    cat <<'MSG'

PRÓXIMO PASSO (uma vez só): conectar o WhatsApp lendo o QR code.
  1) Feche o bot no computador (janela do iniciar.bat).
  2) Rode:   node src/index.js
  3) No celular: WhatsApp > Aparelhos conectados > Conectar um aparelho, e leia o QR code que aparece aqui.
  4) Quando aparecer que o WhatsApp conectou, aperte  Ctrl + C  para parar.
  5) Rode:   bash instalar-vps.sh iniciar
MSG
  fi
}

iniciar() {
  precisa_do_basico
  command -v pm2 >/dev/null 2>&1 || erro "O pm2 não está instalado. Rode primeiro:  bash instalar-vps.sh"
  if [ ! -d auth ] || [ -z "$(ls -A auth 2>/dev/null)" ]; then
    aviso "O WhatsApp ainda não foi conectado (pasta auth vazia). Rode antes:  node src/index.js  e leia o QR code."
    exit 1
  fi
  if pm2 describe "$NOME" >/dev/null 2>&1; then
    pm2 restart "$NOME" --update-env
  else
    # código 10 = o bot parou porque precisa de uma ação sua (ex.: WhatsApp desconectado): não fica reiniciando em loop
    pm2 start src/index.js --name "$NOME" --time --restart-delay 10000 --max-memory-restart 600M --stop-exit-codes 10
  fi
  pm2 save
  # faz o bot voltar sozinho quando a VPS reiniciar
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
  pm2 save
  verde "Bot ligado em segundo plano. Você já pode fechar esta janela."
  echo "Para ver o que ele está fazendo:  bash instalar-vps.sh status"
}

atualizar() {
  precisa_do_basico
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
  if pm2 describe "$NOME" >/dev/null 2>&1; then
    pm2 restart "$NOME" --update-env
    verde "Bot atualizado e reiniciado."
  else
    aviso "O bot ainda não estava ligado. Rode:  bash instalar-vps.sh iniciar"
  fi
}

status() {
  command -v pm2 >/dev/null 2>&1 || erro "O pm2 não está instalado."
  pm2 status
  echo
  echo "Memória:"; free -h | sed -n '1,3p'
  echo
  echo "Últimas linhas do log:"
  pm2 logs "$NOME" --lines 25 --nostream || true
}

case "${1:-instalar}" in
  instalar)  instalar ;;
  iniciar)   iniciar ;;
  atualizar) atualizar ;;
  status)    status ;;
  *) erro "Uso: bash instalar-vps.sh [instalar|iniciar|atualizar|status]" ;;
esac

@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Instalar bot WhatsApp
echo.
echo === Instalando o bot de WhatsApp do Gabriel ===
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo.
  echo A instalacao falhou. Copie a mensagem de erro acima e me envie.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Criei o arquivo .env. Vou abri-lo agora: preencha as chaves, salve e feche.
  notepad .env
)
echo.
echo Pronto. Proximo passo: abrir o iniciar.bat
pause

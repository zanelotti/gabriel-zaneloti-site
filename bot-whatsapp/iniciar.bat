@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bot WhatsApp - Gabriel (nao feche esta janela)
:inicio
node src/index.js
if %errorlevel%==10 goto precisa_de_voce
echo.
echo O bot parou de forma inesperada. Reiniciando em 10 segundos... (feche esta janela para parar de vez)
timeout /t 10 /nobreak >nul
goto inicio
:precisa_de_voce
echo.
echo O bot parou porque precisa de uma acao sua (veja a mensagem acima).
pause

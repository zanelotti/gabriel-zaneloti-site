@echo off
chcp 65001 >nul
echo Configurando o Windows para NAO suspender nem hibernar quando ligado na tomada...
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
echo.
echo Pronto. A tela ainda pode apagar, mas o computador continua ligado e o bot funcionando.
echo Se for notebook, mantenha-o na tomada e com a tampa aberta (ou ajuste "Ao fechar a tampa" para "Nao fazer nada").
pause

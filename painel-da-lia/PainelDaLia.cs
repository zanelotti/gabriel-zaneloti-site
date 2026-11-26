// Painel da Lia: controla o bot do WhatsApp no servidor sem digitar comandos.
// Compilado para .NET Framework 4.x (já vem no Windows 10/11).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

static class Cfg
{
    public const string Ip = "13.140.223.250";
    public const string Usuario = "root";
    public const string Repo = @"C:\9 - INSS de obra\gabriel-zaneloti-site";
    public const string PastaServidor = "/root/gabriel-zaneloti-site";
    public const string Servico = "bot-whatsapp";
}

class Resultado
{
    public int Codigo;
    public string Saida = "";
    public bool Ok { get { return Codigo == 0; } }
}

class Painel : Form
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    readonly Color Verde = Color.FromArgb(26, 162, 96);
    readonly Color VerdeEscuro = Color.FromArgb(20, 83, 45);
    readonly Color Vermelho = Color.FromArgb(200, 50, 50);
    readonly Color Cinza = Color.FromArgb(150, 150, 150);
    readonly Color Amarelo = Color.FromArgb(220, 160, 20);

    Panel bolinha;
    Color corBolinha;
    Label titulo, subtitulo;
    TextBox log;
    FlowLayoutPanel botoes;
    Timer relogio;
    bool ocupado;

    [STAThread]
    static void Main()
    {
        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Painel());
    }

    Painel()
    {
        corBolinha = Cinza;
        Text = "Painel da Lia — Bot do WhatsApp";
        Font = new Font("Segoe UI", 10f);
        BackColor = Color.FromArgb(243, 243, 243);
        StartPosition = FormStartPosition.CenterScreen;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(680, 780);
        MinimumSize = new Size(560, 560);

        var raiz = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), ColumnCount = 1, RowCount = 4 };
        raiz.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        raiz.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        raiz.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        raiz.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        Controls.Add(raiz);

        // ---------- status
        var cartao = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, BackColor = Color.White, ColumnCount = 2, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 12) };
        cartao.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 44));
        cartao.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        bolinha = new Panel { Size = new Size(26, 26), Margin = new Padding(4, 8, 8, 4) };
        bolinha.Paint += (s, e) =>
        {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using (var b = new SolidBrush(corBolinha)) e.Graphics.FillEllipse(b, 1, 1, bolinha.Width - 3, bolinha.Height - 3);
        };
        var textos = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, WrapContents = false, Dock = DockStyle.Fill };
        titulo = new Label { AutoSize = true, Font = new Font("Segoe UI", 13f, FontStyle.Bold), Text = "Verificando a Lia..." };
        subtitulo = new Label { AutoSize = true, ForeColor = Color.FromArgb(85, 85, 85), Text = "Servidor Contabo " + Cfg.Ip, MaximumSize = new Size(560, 0) };
        textos.Controls.Add(titulo);
        textos.Controls.Add(subtitulo);
        cartao.Controls.Add(bolinha, 0, 0);
        cartao.Controls.Add(textos, 1, 0);
        raiz.Controls.Add(cartao, 0, 0);

        // ---------- botões
        botoes = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Margin = new Padding(0) };
        Botao("Verificar agora", "Mostra se a Lia está ligada", false, async () => await Verificar());
        Botao("Reiniciar a Lia", "Desliga e liga de novo", false, async () => await Reiniciar());
        Botao("Instalar atualização", "Pega o pacote em Downloads e faz tudo", true, async () => await InstalarAtualizacao());
        Botao("Ver últimas mensagens", "O que a Lia fez nos últimos minutos", false, async () => await VerMensagens());
        Botao("Desligar a Lia", "Ela para de responder", false, async () => await Desligar());
        Botao("Ligar a Lia", "Volta a responder", false, async () => await Ligar());
        Botao("Procurar conversa", "O que aconteceu com um telefone", false, async () => await ProcurarTelefone());
        Botao("Trocar chave da API", "Quando a chave da Anthropic vencer", false, async () => await TrocarChave());
        Botao("Configurar acesso", "Só na primeira vez (pede a senha)", false, async () => { ConfigurarAcesso(); await Task.FromResult(0); });
        Botao("Reinstalar a Lia", "Servidor novo: instala tudo do zero", false, async () => await ReinstalarLia());
        Botao("Conectar o WhatsApp", "Mostra o QR code para ler no celular", false, async () => { ConectarWhatsApp(); await Task.FromResult(0); });
        Botao("Organizar o quadro", "A Lia lê as conversas e arruma os cards", false, async () => await OrganizarQuadro());
        Botao("Clientes para agir", "Quem tem chance de fechar e o que fazer", true, async () => await ClientesParaAgir());
        raiz.Controls.Add(botoes, 0, 1);
        botoes.Resize += (s, e) => AjustarBotoes();

        // ---------- log
        log = new TextBox
        {
            Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(30, 30, 30), ForeColor = Color.FromArgb(207, 232, 213),
            Font = new Font("Consolas", 9.5f), BorderStyle = BorderStyle.None, Margin = new Padding(0, 10, 0, 0), WordWrap = true
        };
        raiz.Controls.Add(log, 0, 2);

        var rodape = new Label { AutoSize = true, ForeColor = Color.FromArgb(110, 110, 110), Margin = new Padding(0, 8, 0, 0), Text = "A senha do servidor nunca é guardada por este painel." };
        raiz.Controls.Add(rodape, 0, 3);

        // Avisos de "tentando de novo" só aparecem quando o Gabriel clicou em algo (não na verificação automática).
        AvisoTentativa = t => { try { BeginInvoke((Action)(() => { if (ocupado) Escrever(t); })); } catch { } };

        relogio = new Timer { Interval = 3 * 60 * 1000 };
        relogio.Tick += async (s, e) => { if (!ocupado) await Verificar(true); };
        Shown += async (s, e) => { AjustarBotoes(); await Verificar(); relogio.Start(); };
    }

    void Botao(string nome, string dica, bool destaque, Func<Task> acao)
    {
        var b = new Button
        {
            Text = nome + "\r\n" + dica, TextAlign = ContentAlignment.MiddleLeft, FlatStyle = FlatStyle.Flat,
            Height = 62, Margin = new Padding(0, 0, 10, 10), Padding = new Padding(10, 0, 4, 0), Cursor = Cursors.Hand,
            BackColor = destaque ? Color.FromArgb(31, 122, 90) : Color.White,
            ForeColor = destaque ? Color.White : Color.FromArgb(27, 27, 27)
        };
        b.FlatAppearance.BorderColor = destaque ? Color.FromArgb(31, 122, 90) : Color.FromArgb(208, 208, 208);
        b.Click += async (s, e) =>
        {
            if (ocupado) return;
            ocupado = true;
            foreach (Control c in botoes.Controls) c.Enabled = false;
            UseWaitCursor = true;
            try { await acao(); }
            catch (Exception ex) { Escrever("ERRO: " + ex.Message); }
            finally
            {
                UseWaitCursor = false;
                foreach (Control c in botoes.Controls) c.Enabled = true;
                ocupado = false;
            }
        };
        botoes.Controls.Add(b);
    }

    void AjustarBotoes()
    {
        int largura = (botoes.ClientSize.Width - 22) / 2;
        if (largura < 150) largura = 150;
        foreach (Control c in botoes.Controls) c.Width = largura;
    }

    // ------------------------------------------------------------------ utilidades
    void Escrever(string texto)
    {
        if (texto == null) return;
        texto = texto.Replace("\r\n", "\n").Replace("\n", "\r\n").TrimEnd();
        if (texto.Length == 0) return;
        log.AppendText(texto + "\r\n");
    }

    void Status(Color cor, string t, string sub)
    {
        corBolinha = cor;
        bolinha.Invalidate();
        titulo.Text = t;
        titulo.ForeColor = cor == Verde ? VerdeEscuro : (cor == Vermelho ? Vermelho : Color.FromArgb(60, 60, 60));
        subtitulo.Text = sub;
    }

    static string Sistema(string relativo)
    {
        string win = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        foreach (var pasta in new[] { "System32", "Sysnative" })
        {
            string p = Path.Combine(win, pasta, relativo);
            if (File.Exists(p)) return p;
        }
        return Path.GetFileName(relativo);
    }

    static string Ssh { get { return Sistema(@"OpenSSH\ssh.exe"); } }
    static string Scp { get { return Sistema(@"OpenSSH\scp.exe"); } }
    static string Tar { get { return Sistema("tar.exe"); } }

    static string Git
    {
        get
        {
            foreach (var p in new[] { @"C:\Program Files\Git\cmd\git.exe", @"C:\Program Files (x86)\Git\cmd\git.exe" })
                if (File.Exists(p)) return p;
            return "git";
        }
    }

    static string Aspas(string s) { return "\"" + s + "\""; }

    static string OpcoesSsh
    {
        get { return "-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"; }
    }

    // Quando robôs ficam batendo na porta 22, o servidor às vezes derruba a conexão logo no começo
    // ("kex_exchange_identification ... Connection reset"). Nesse caso nada chegou a rodar lá, então é seguro
    // tentar de novo. O ssh/scp tenta até 6 vezes, esperando um pouco mais a cada vez (até uns 2,5 minutos no total).
    static Action<string> AvisoTentativa;

    static bool QuedaNoInicio(Resultado r)
    {
        if (r.Codigo != 255) return false;
        if (Regex.IsMatch(r.Saida, "Permission denied|Host key verification failed", RegexOptions.IgnoreCase)) return false;
        return Regex.IsMatch(r.Saida,
            "kex_exchange_identification|banner exchange|Connection reset|Connection closed by|Connection timed out|Connection refused|ssh_exchange_identification",
            RegexOptions.IgnoreCase);
    }

    static Task<Resultado> Rodar(string exe, string args, string entrada = null, string pasta = null)
    {
        if (exe != Ssh && exe != Scp) return RodarUmaVez(exe, args, entrada, pasta);
        return Task.Run(async () =>
        {
            int[] esperas = { 10, 15, 20, 30, 45 };
            var r = await RodarUmaVez(exe, args, entrada, pasta);
            for (int i = 0; i < esperas.Length && QuedaNoInicio(r); i++)
            {
                var aviso = AvisoTentativa;
                if (aviso != null) aviso("   O servidor recusou a conexão (robôs na porta). Tentando de novo em " + esperas[i] + " s... (" + (i + 2) + "/6)");
                await Task.Delay(esperas[i] * 1000);
                r = await RodarUmaVez(exe, args, entrada, pasta);
            }
            return r;
        });
    }

    static Task<Resultado> RodarUmaVez(string exe, string args, string entrada = null, string pasta = null)
    {
        return Task.Run(() =>
        {
            var r = new Resultado();
            var psi = new ProcessStartInfo(exe, args)
            {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
            };
            if (pasta != null) psi.WorkingDirectory = pasta;
            try
            {
                using (var p = Process.Start(psi))
                {
                    var tOut = p.StandardOutput.ReadToEndAsync();
                    var tErr = p.StandardError.ReadToEndAsync();
                    using (var w = new StreamWriter(p.StandardInput.BaseStream, new UTF8Encoding(false)))
                    {
                        if (entrada != null) w.Write(entrada.Replace("\r\n", "\n"));
                    }
                    p.WaitForExit();
                    r.Codigo = p.ExitCode;
                    r.Saida = (tOut.Result + "\n" + tErr.Result).Trim();
                }
            }
            catch (Exception ex)
            {
                r.Codigo = -1;
                r.Saida = "Não consegui abrir " + exe + ": " + ex.Message;
            }
            return r;
        });
    }

    // Roda um script bash no servidor (o script vai pela entrada, sem problema de aspas).
    Task<Resultado> NoServidor(string script)
    {
        return Rodar(Ssh, OpcoesSsh + " " + Cfg.Usuario + "@" + Cfg.Ip + " bash -s", script);
    }

    bool SemAcesso(Resultado r)
    {
        if (r.Codigo != 255 && r.Codigo != -1) return false;
        Status(Cinza, "Não consegui falar com o servidor",
            "Se for a primeira vez, clique em \"Configurar acesso\". Se não, confira a internet.");
        Escrever(r.Saida);
        return true;
    }

    string UltimasLinhas(int n)
    {
        return "journalctl -u " + Cfg.Servico + " -n " + n + " --no-pager -o cat\n";
    }

    // Só as linhas do próprio bot (começam com a hora), sem os blocos técnicos da criptografia do WhatsApp.
    string LinhasDoBot(string desde, int n, string filtro = null)
    {
        string f = filtro == null ? "" : " | grep -F -- '" + filtro + "'";
        return "journalctl -u " + Cfg.Servico + " --since '" + desde + "' --no-pager -o cat | grep -E '^[0-9]{1,2}:[0-9]{2}:[0-9]{2} '" + f + " | tail -n " + n + "\n";
    }

    // ------------------------------------------------------------------ ações
    async Task Verificar(bool silencioso = false)
    {
        if (!silencioso) Status(Amarelo, "Verificando a Lia...", "Falando com o servidor " + Cfg.Ip);
        var r = await NoServidor(
            "echo \"ESTADO=$(systemctl is-active " + Cfg.Servico + ")\"\n" +
            "echo \"DESDE=$(systemctl show " + Cfg.Servico + " -p ActiveEnterTimestamp --value)\"\n" +
            "echo \"WHATS=$(journalctl -u " + Cfg.Servico + " -n 400 --no-pager -o cat | grep '\\[whatsapp\\]' | tail -1)\"\n");
        if (SemAcesso(r)) return;
        string estado = Pegar(r.Saida, "ESTADO"), desde = Pegar(r.Saida, "DESDE"), whats = Pegar(r.Saida, "WHATS");
        string hora = DateTime.Now.ToString("HH:mm");
        if (estado != "active")
        {
            Status(Vermelho, "Lia está DESLIGADA", "Última verificação às " + hora + ". Clique em \"Ligar a Lia\".");
            return;
        }
        bool conectado = Regex.IsMatch(whats, @"\[whatsapp\]\s*conectado", RegexOptions.IgnoreCase);
        string sub = "Servidor Contabo · última verificação às " + hora + (desde.Length > 0 ? " · ligada desde " + Desde(desde) : "");
        if (conectado) Status(Verde, "Lia está LIGADA e conectada ao WhatsApp", sub);
        else Status(Amarelo, "Lia está ligada, mas o WhatsApp não está conectado", sub + "\r\nÚltimo aviso: " + (whats.Length > 0 ? whats : "nenhum"));
    }

    static string Pegar(string saida, string chave)
    {
        foreach (var l in saida.Split('\n'))
            if (l.StartsWith(chave + "=")) return l.Substring(chave.Length + 1).Trim();
        return "";
    }

    static string Desde(string ts)
    {
        // Ex.: "Sat 2026-11-14 16:30:13 UTC" -> horário do Windows
        var m = Regex.Match(ts, @"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})");
        DateTime d;
        if (m.Success && DateTime.TryParse(m.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal, out d))
            return d.ToString("dd/MM 'às' HH:mm");
        return ts;
    }

    async Task Reiniciar()
    {
        Escrever("\r\n>> Reiniciando a Lia...");
        var r = await NoServidor("systemctl restart " + Cfg.Servico + " && sleep 10\n" + UltimasLinhas(8));
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        await Verificar();
    }

    async Task VerMensagens()
    {
        Escrever("\r\n>> Últimas mensagens da Lia:");
        var r = await NoServidor(LinhasDoBot("-48h", 60));
        if (SemAcesso(r)) return;
        Escrever(r.Saida.Length > 0 ? r.Saida : "(nenhuma mensagem do bot nas últimas 48 horas)");
        Escrever("(horários do servidor: 3 horas a mais que Brasília)");
    }

    async Task ProcurarTelefone()
    {
        string tel = Perguntar("Procurar conversa", "Digite o telefone do cliente (pode ser com DDD, só números):", "", false);
        if (tel == null) return;
        string digitos = new string(tel.Where(char.IsDigit).ToArray());
        if (digitos.Length < 8)
        {
            MessageBox.Show(this, "Digite pelo menos 8 números do telefone.", "Procurar conversa", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        string fim = digitos.Substring(digitos.Length - 8);
        Escrever("\r\n>> O que aconteceu com o telefone terminado em " + fim + " (últimos 7 dias):");
        var r = await NoServidor(LinhasDoBot("-7d", 60, fim));
        if (SemAcesso(r)) return;
        Escrever(r.Saida.Length > 0 ? r.Saida : "(nada encontrado para esse telefone nos últimos 7 dias)");
        Escrever("(horários do servidor: 3 horas a mais que Brasília)");
    }

    async Task Desligar()
    {
        if (MessageBox.Show(this, "Desligar a Lia? Ela vai parar de responder no WhatsApp até você clicar em \"Ligar a Lia\".",
            "Desligar a Lia", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        Escrever("\r\n>> Desligando a Lia...");
        var r = await NoServidor("systemctl stop " + Cfg.Servico + " && echo 'Lia desligada.'\n");
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        await Verificar();
    }

    async Task Ligar()
    {
        Escrever("\r\n>> Ligando a Lia...");
        var r = await NoServidor("systemctl start " + Cfg.Servico + " && sleep 10\n" + UltimasLinhas(8));
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        await Verificar();
    }

    async Task InstalarAtualizacao()
    {
        string downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        var pacote = new DirectoryInfo(downloads).GetFiles("atualizacao-lia*.tgz")
            .OrderByDescending(f => f.LastWriteTime).FirstOrDefault();
        if (pacote == null)
        {
            MessageBox.Show(this, "Não achei nenhum pacote \"atualizacao-lia...tgz\" na pasta Downloads.\n\nBaixe o pacote que o Claude te mandou e clique de novo.",
                "Instalar atualização", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        if (!Directory.Exists(Cfg.Repo))
        {
            MessageBox.Show(this, "Não achei a pasta do site:\n" + Cfg.Repo, "Instalar atualização", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        string padrao = "Atualização da Lia (" + Path.GetFileNameWithoutExtension(pacote.Name) + ")";
        string mensagem = Perguntar("Instalar atualização",
            "Vou instalar o pacote:\n" + pacote.Name + " (baixado em " + pacote.LastWriteTime.ToString("dd/MM 'às' HH:mm") + ")\n\nDescrição do commit (pode deixar como está):",
            padrao, false);
        if (mensagem == null) return;
        if (mensagem.Trim().Length == 0) mensagem = padrao;

        Escrever("\r\n>> 1/5 Colocando os arquivos novos na pasta do site...");
        var r = await Rodar(Tar, "-xzf " + Aspas(pacote.FullName) + " -C " + Aspas(Cfg.Repo));
        Escrever(r.Saida);
        if (!r.Ok) { Escrever("Parei: não consegui abrir o pacote."); return; }

        Escrever(">> 2/5 Salvando no GitHub (commit e push)...");
        r = await Rodar(Git, "add -A", null, Cfg.Repo);
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: o git add falhou."); return; }
        r = await Rodar(Git, "commit -m " + Aspas(mensagem.Replace("\"", "'")), null, Cfg.Repo);
        Escrever(r.Saida);
        if (!r.Ok && !Regex.IsMatch(r.Saida, "nothing to commit|nada a submeter|nothing added", RegexOptions.IgnoreCase))
        { Escrever("Parei: o commit falhou."); return; }
        r = await Rodar(Git, "push", null, Cfg.Repo);
        Escrever(r.Saida);
        if (!r.Ok) { Escrever("Parei: o push falhou. Os arquivos já estão no PC; me mande um print disto."); return; }

        Escrever(">> 3/5 Empacotando para o servidor...");
        string tmp = Path.Combine(Path.GetTempPath(), "bot.tgz");
        r = await Rodar(Tar, "-czf " + Aspas(tmp) + " --exclude=bot-whatsapp/node_modules --exclude=bot-whatsapp/auth --exclude=bot-whatsapp/.env bot-whatsapp src/data", null, Cfg.Repo);
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: não consegui empacotar."); return; }

        Escrever(">> 4/5 Enviando para o servidor...");
        r = await Rodar(Scp, OpcoesSsh + " " + Aspas(tmp) + " " + Cfg.Usuario + "@" + Cfg.Ip + ":/root/bot.tgz");
        if (SemAcesso(r)) return;
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: o envio falhou."); return; }

        Escrever(">> 5/5 Instalando no servidor e reiniciando a Lia...");
        r = await NoServidor(
            "set -e\n" +
            "cd " + Cfg.PastaServidor + "\n" +
            "ANTES=$(md5sum bot-whatsapp/package.json 2>/dev/null | cut -d' ' -f1)\n" +
            "tar -xzf /root/bot.tgz -C " + Cfg.PastaServidor + "\n" +
            "DEPOIS=$(md5sum bot-whatsapp/package.json 2>/dev/null | cut -d' ' -f1)\n" +
            "if [ \"$ANTES\" != \"$DEPOIS\" ]; then echo 'Instalando bibliotecas novas...'; (cd bot-whatsapp && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3); fi\n" +
            "systemctl restart " + Cfg.Servico + "\n" +
            "sleep 10\n" + UltimasLinhas(8));
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        if (!r.Ok) { Escrever("Parei: algo deu errado no servidor. Me mande um print."); return; }

        try
        {
            string guardados = Path.Combine(downloads, "Lia - pacotes instalados");
            Directory.CreateDirectory(guardados);
            string destino = Path.Combine(guardados, pacote.Name);
            if (File.Exists(destino)) destino = Path.Combine(guardados, Path.GetFileNameWithoutExtension(pacote.Name) + "-" + DateTime.Now.ToString("yyyyMMdd-HHmm") + ".tgz");
            pacote.MoveTo(destino);
            Escrever("Pacote guardado em Downloads\\Lia - pacotes instalados.");
        }
        catch { }
        Escrever(">> Atualização instalada.");
        await ProtegerServidor();
        await Verificar();
    }

    // Uma vez só: liga o fail2ban (bloqueia por 1 hora quem erra a senha 5 vezes, ou seja, os robôs) e deixa o
    // servidor aceitar mais conexões ao mesmo tempo, para os robôs não "lotarem a porta" e derrubarem o Painel.
    // Quem entra pelo Painel usa chave (não erra senha) e o IP de quem está instalando fica liberado.
    async Task ProtegerServidor()
    {
        var r = await NoServidor(
            "[ -f /etc/fail2ban/jail.d/lia.conf ] && systemctl is-active --quiet fail2ban && exit 0\n" +
            "echo '>> Protegendo o servidor contra robôs (só desta vez, leva cerca de 1 minuto)...'\n" +
            "MEU_IP=$(echo $SSH_CLIENT | cut -d' ' -f1)\n" +
            "export DEBIAN_FRONTEND=noninteractive\n" +
            "apt-get -o DPkg::Lock::Timeout=120 install -y -q fail2ban python3-systemd >/dev/null 2>&1 || " +
            "{ apt-get -o DPkg::Lock::Timeout=120 update -q >/dev/null 2>&1; apt-get -o DPkg::Lock::Timeout=120 install -y -q fail2ban python3-systemd >/dev/null 2>&1; }\n" +
            "mkdir -p /etc/fail2ban/jail.d\n" +
            "printf '[sshd]\\nenabled = true\\nbackend = systemd\\nmaxretry = 5\\nfindtime = 10m\\nbantime = 1h\\nignoreip = 127.0.0.1/8 ::1 %s\\n' \"$MEU_IP\" > /etc/fail2ban/jail.d/lia.conf\n" +
            "systemctl enable fail2ban >/dev/null 2>&1; systemctl restart fail2ban >/dev/null 2>&1; sleep 3\n" +
            "printf 'MaxStartups 50:30:200\\nLoginGraceTime 20\\n' > /etc/ssh/sshd_config.d/10-lia.conf\n" +
            "if /usr/sbin/sshd -t >/dev/null 2>&1; then systemctl reload ssh >/dev/null 2>&1 || true; else rm -f /etc/ssh/sshd_config.d/10-lia.conf; fi\n" +
            "if systemctl is-active --quiet fail2ban; then echo 'Proteção ligada: robôs que errarem a senha ficam bloqueados por 1 hora.';\n" +
            "else rm -f /etc/fail2ban/jail.d/lia.conf; echo 'Aviso: não consegui ligar a proteção agora (a Lia está ok). Tento de novo na próxima atualização.'; fi\n");
        if (r.Codigo == 255 || r.Codigo == -1) return; // sem conexão: tenta na próxima atualização
        Escrever(r.Saida);
    }

    async Task TrocarChave()
    {
        string chave = Perguntar("Trocar chave da API",
            "1. No console da Anthropic, crie uma chave nova e clique em Copy.\n2. Cole aqui (ela fica escondida) e clique em OK.\n\nO painel testa a chave antes de trocar.",
            "", true);
        if (chave == null) return;
        chave = chave.Trim();
        if (!Regex.IsMatch(chave, @"^sk-ant-[A-Za-z0-9_\-]{20,}$"))
        {
            MessageBox.Show(this, "Isso não parece uma chave da Anthropic (ela começa com sk-ant-). Nada foi alterado.",
                "Trocar chave", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        Escrever("\r\n>> Testando a chave nova...");
        string env = Cfg.PastaServidor + "/bot-whatsapp/.env";
        var r = await NoServidor(
            "K='" + chave + "'\n" +
            "F=" + env + "\n" +
            "M=$(grep '^ANTHROPIC_MODEL=' $F | cut -d= -f2-)\n" +
            "C=$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/messages -H \"x-api-key: $K\" -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' -d \"{\\\"model\\\":\\\"${M:-claude-sonnet-5-5}\\\",\\\"max_tokens\\\":5,\\\"messages\\\":[{\\\"role\\\":\\\"user\\\",\\\"content\\\":\\\"oi\\\"}]}\")\n" +
            "if [ \"$C\" != \"200\" ]; then echo \"A chave nova NAO funcionou (codigo $C). Nada foi alterado.\"; exit 3; fi\n" +
            "cp $F $F.bak\n" +
            "if grep -q '^ANTHROPIC_API_KEY=' $F; then sed -i \"s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$K|\" $F; else echo \"ANTHROPIC_API_KEY=$K\" >> $F; fi\n" +
            "echo 'Chave testada e trocada. Reiniciando a Lia...'\n" +
            "systemctl restart " + Cfg.Servico + "\n" +
            "sleep 10\n" + UltimasLinhas(6));
        chave = null;
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        if (r.Ok) MessageBox.Show(this, "Chave trocada! Agora você pode apagar a chave antiga no console da Anthropic.",
            "Trocar chave", MessageBoxButtons.OK, MessageBoxIcon.Information);
        await Verificar();
    }

    void ConfigurarAcesso()
    {
        string ssh = Ssh, keygen = Sistema(@"OpenSSH\ssh-keygen.exe");
        string chave = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ssh", "id_ed25519");
        string script = Path.Combine(Path.GetTempPath(), "configurar-acesso-lia.cmd");
        var sb = new StringBuilder();
        sb.AppendLine("@echo off");
        sb.AppendLine("chcp 65001 >nul");
        sb.AppendLine("title Configurar acesso ao servidor da Lia");
        sb.AppendLine("echo.");
        sb.AppendLine("echo  Configurando o acesso ao servidor (so precisa fazer 1 vez).");
        sb.AppendLine("echo.");
        sb.AppendLine("if not exist \"" + Path.GetDirectoryName(chave) + "\" mkdir \"" + Path.GetDirectoryName(chave) + "\"");
        sb.AppendLine("if not exist \"" + chave + "\" \"" + keygen + "\" -q -t ed25519 -N \"\" -f \"" + chave + "\"");
        // Servidor reinstalado tem "identidade" nova: apaga a antiga para o SSH não recusar a conexão.
        sb.AppendLine("\"" + keygen + "\" -R " + Cfg.Ip + " >nul 2>&1");
        sb.AppendLine("echo  Agora digite a SENHA DO SERVIDOR e aperte Enter.");
        sb.AppendLine("echo  (a senha nao aparece enquanto voce digita, e normal)");
        sb.AppendLine("echo.");
        sb.AppendLine("type \"" + chave + ".pub\" | \"" + ssh + "\" -o StrictHostKeyChecking=accept-new " + Cfg.Usuario + "@" + Cfg.Ip +
            " \"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo OK\"");
        sb.AppendLine("echo.");
        sb.AppendLine("if %errorlevel%==0 (echo  PRONTO! Pode fechar esta janela e voltar ao Painel da Lia.) else (echo  Nao deu certo. Tire um print desta janela e mande para o Claude.)");
        sb.AppendLine("echo.");
        sb.AppendLine("pause");
        File.WriteAllText(script, sb.ToString(), new UTF8Encoding(false));
        Process.Start(new ProcessStartInfo("cmd.exe", "/c " + Aspas(script)) { UseShellExecute = true });
        Escrever("\r\n>> Abri uma janela para configurar o acesso. Digite a senha do servidor lá.\r\nDepois clique em \"Verificar agora\".");
    }


    // ------------------------------------------------------------------ reinstalação (servidor novo)
    async Task ReinstalarLia()
    {
        string pastaBot = Path.Combine(Cfg.Repo, "bot-whatsapp");
        string envLocal = Path.Combine(pastaBot, ".env");
        if (!File.Exists(envLocal))
        {
            MessageBox.Show(this, "Não achei o arquivo .env em:\n" + pastaBot, "Reinstalar a Lia", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        if (MessageBox.Show(this,
            "Use isto só depois de REINSTALAR o servidor na Contabo e clicar em \"Configurar acesso\".\n\n" +
            "Antes de continuar, confirme:\n" +
            "• Você já colocou as chaves NOVAS (Claude e Resend) no arquivo .env do computador.\n\n" +
            "Vou instalar tudo no servidor (leva uns 5 minutos). Continuar?",
            "Reinstalar a Lia", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;

        Escrever("\r\n>> 1/4 Testando o acesso ao servidor novo...");
        var r = await NoServidor("echo ACESSO_OK; . /etc/os-release; echo \"$PRETTY_NAME\"\n");
        if (SemAcesso(r)) { Escrever("Clique em \"Configurar acesso\", digite a senha NOVA do servidor e tente de novo."); return; }
        Escrever(r.Saida);

        Escrever(">> 2/4 Empacotando a Lia e as chaves...");
        string tmp = Path.Combine(Path.GetTempPath(), "lia-completa.tgz");
        r = await Rodar(Tar, "-czf " + Aspas(tmp) + " --exclude=bot-whatsapp/node_modules --exclude=bot-whatsapp/auth --exclude=bot-whatsapp/cache bot-whatsapp src/data", null, Cfg.Repo);
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: não consegui empacotar."); return; }

        Escrever(">> 3/4 Enviando para o servidor...");
        r = await Rodar(Scp, OpcoesSsh + " " + Aspas(tmp) + " " + Cfg.Usuario + "@" + Cfg.Ip + ":/root/lia-completa.tgz");
        try { File.Delete(tmp); } catch { }
        if (SemAcesso(r)) return;
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: o envio falhou."); return; }

        Escrever(">> 4/4 Instalando no servidor (uns 5 minutos, não feche o painel)...");
        r = await NoServidor(ScriptInstalacao());
        Escrever(r.Saida);
        if (SemAcesso(r)) return;
        if (!r.Ok) { Escrever("Parei: algo deu errado na instalação. Me mande um print desta tela."); return; }
        Escrever(">> Instalação concluída. Agora clique em \"Conectar o WhatsApp\" e leia o QR code com o celular.");
        Status(Amarelo, "Lia instalada, falta conectar o WhatsApp", "Clique em \"Conectar o WhatsApp\".");
    }

    string ScriptInstalacao()
    {
        string pasta = Cfg.PastaServidor, svc = Cfg.Servico;
        return string.Join("\n", new[] {
            "set -e",
            "export DEBIAN_FRONTEND=noninteractive",
            "echo '- atualizando o sistema...'",
            "apt-get update -qq >/dev/null",
            "apt-get -y -qq -o Dpkg::Options::=--force-confold upgrade >/dev/null || true",
            "apt-get install -y -qq curl ca-certificates ufw unattended-upgrades >/dev/null",
            "if ! swapon --show | grep -q .; then echo '- criando memória extra...'; fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && (grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab); fi",
            "if ! command -v node >/dev/null || [ \"$(node -p 'process.versions.node.split(\".\")[0]')\" -lt 20 ]; then echo '- instalando o Node 22...'; curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null; apt-get install -y -qq nodejs >/dev/null; fi",
            "echo \"- Node $(node -v)\"",
            "systemctl stop " + svc + " 2>/dev/null || true",
            "mkdir -p " + pasta,
            "tar -xzf /root/lia-completa.tgz -C " + pasta,
            "rm -f /root/lia-completa.tgz",
            "cd " + pasta + "/bot-whatsapp",
            "sed -i 's/\\r$//' .env && chmod 600 .env",
            "echo '- instalando as peças da Lia (pode demorar)...'",
            "npm ci --omit=dev --no-audit --no-fund >/tmp/npm.log 2>&1 || (tail -20 /tmp/npm.log; exit 1)",
            "cat > /etc/systemd/system/" + svc + ".service <<'UNIT'",
            "[Unit]",
            "Description=Lia - bot do WhatsApp do Gabriel",
            "After=network-online.target",
            "Wants=network-online.target",
            "[Service]",
            "WorkingDirectory=" + pasta + "/bot-whatsapp",
            "ExecStart=/usr/bin/node src/index.js",
            "Restart=always",
            "RestartSec=10",
            "RestartPreventExitStatus=10",
            "Environment=NODE_ENV=production",
            "[Install]",
            "WantedBy=multi-user.target",
            "UNIT",
            "systemctl daemon-reload",
            "cat > /root/parear-lia.sh <<'PAREAR'",
            "#!/bin/bash",
            "systemctl stop " + svc + " 2>/dev/null",
            "cd " + pasta + "/bot-whatsapp",
            "rm -rf auth /tmp/parear.log",
            "echo; echo '  Aguarde o QR code aparecer (uns 20 segundos)...'; echo",
            "node src/index.js 2>&1 | tee /tmp/parear.log &",
            "for i in $(seq 1 150); do sleep 2; grep -q '\\[whatsapp\\] conectado' /tmp/parear.log && break; done",
            "sleep 8",
            "pkill -f 'node src/index.js'; sleep 3",
            "if grep -q '\\[whatsapp\\] conectado' /tmp/parear.log; then systemctl enable --now " + svc + " >/dev/null 2>&1; echo; echo '  PRONTO! WhatsApp conectado e a Lia está ligada. Pode fechar esta janela.'; else echo; echo '  Não conectou a tempo. Feche esta janela e clique de novo em Conectar o WhatsApp.'; fi",
            "PAREAR",
            "chmod 700 /root/parear-lia.sh",
            "echo '- protegendo o servidor (firewall e atualizações automáticas)...'",
            "ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null; ufw allow 22/tcp >/dev/null; ufw --force enable >/dev/null",
            "if [ -s /root/.ssh/authorized_keys ]; then printf 'PasswordAuthentication no\\nKbdInteractiveAuthentication no\\nPermitRootLogin prohibit-password\\n' > /etc/ssh/sshd_config.d/10-lia.conf; systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true; echo '- login por senha desligado (só este computador entra)'; fi",
            "echo '- testando a chave da Claude...'",
            "K=$(grep '^ANTHROPIC_API_KEY=' .env | cut -d= -f2-); M=$(grep '^ANTHROPIC_MODEL=' .env | cut -d= -f2-)",
            "C=$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/messages -H \"x-api-key: $K\" -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' -d \"{\\\"model\\\":\\\"${M:-claude-sonnet-5-5}\\\",\\\"max_tokens\\\":5,\\\"messages\\\":[{\\\"role\\\":\\\"user\\\",\\\"content\\\":\\\"oi\\\"}]}\")",
            "if [ \"$C\" = 200 ]; then echo '- chave da Claude OK'; else echo \"- ATENÇÃO: a chave da Claude não funcionou (código $C). Confira o .env.\"; fi",
            "unset K",
            "echo '- configurações (sem as chaves):'",
            "grep -E '^[A-Z_]+=' .env | grep -viE 'KEY|SECRET|TOKEN|PASS' | sed 's/^/    /'",
            "echo 'INSTALACAO_OK'",
            ""
        });
    }

    void ConectarWhatsApp()
    {
        if (MessageBox.Show(this,
            "Vou abrir uma janela com o QR code.\n\n" +
            "No celular: WhatsApp Business > três pontinhos > Aparelhos conectados > Conectar um aparelho, e aponte para o QR code.\n\n" +
            "Atenção: isto desconecta a sessão atual da Lia (se houver) e cria uma nova. Continuar?",
            "Conectar o WhatsApp", MessageBoxButtons.YesNo, MessageBoxIcon.Information) != DialogResult.Yes) return;
        string script = Path.Combine(Path.GetTempPath(), "conectar-whatsapp-lia.cmd");
        var sb = new StringBuilder();
        sb.AppendLine("@echo off");
        sb.AppendLine("chcp 65001 >nul");
        sb.AppendLine("mode con: cols=110 lines=60");
        sb.AppendLine("title Conectar o WhatsApp da Lia");
        sb.AppendLine("\"" + Ssh + "\" -t -o ConnectTimeout=15 " + Cfg.Usuario + "@" + Cfg.Ip + " bash /root/parear-lia.sh");
        sb.AppendLine("echo.");
        sb.AppendLine("pause");
        File.WriteAllText(script, sb.ToString(), new UTF8Encoding(false));
        Process.Start(new ProcessStartInfo("cmd.exe", "/c " + Aspas(script)) { UseShellExecute = true });
        Escrever("\r\n>> Abri a janela do QR code. Leia com o celular. Quando aparecer PRONTO, feche a janela e clique em \"Verificar agora\".");
    }


    async Task OrganizarQuadro()
    {
        Escrever("\r\n>> Lendo as conversas e analisando os cards (leva de 1 a 3 minutos, nada é alterado ainda)...");
        string dir = Cfg.PastaServidor + "/bot-whatsapp";
        var r = await NoServidor("cd " + dir + " && node scripts/organizar-quadro.js 2>&1\n");
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
        if (!r.Ok) { Escrever("Parei: deu erro na análise. Me mande um print."); return; }
        if (!r.Saida.Contains("MUDANÇAS SUGERIDAS")) return;
        if (MessageBox.Show(this,
            "A lista de mudanças está na parte preta do painel.\n\nQuer aplicar essas mudanças no quadro do CRM agora?\n\n(Cards em \"Fechado\" nunca são mexidos. Cada card movido ganha uma nota com o motivo.)",
            "Organizar o quadro", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes)
        { Escrever("Ok, nada foi alterado."); return; }
        r = await NoServidor("cd " + dir + " && node scripts/organizar-quadro.js --aplicar 2>&1\n");
        if (SemAcesso(r)) return;
        Escrever(r.Saida);
    }

    async Task ClientesParaAgir()
    {
        Escrever("\r\n>> A Lia está lendo as conversas para ver quem tem chance de fechar (leva de 1 a 3 minutos, nada é alterado)...");
        string dir = Cfg.PastaServidor + "/bot-whatsapp";
        var r = await NoServidor("cd " + dir + " && node scripts/clientes-para-agir.js 2>&1\n");
        if (SemAcesso(r)) return;
        if (!r.Ok) { Escrever(r.Saida); Escrever("Parei: deu erro na análise. Me mande um print."); return; }
        Escrever("Pronto: abri a lista numa janela grande.");
        MostrarClientes(r.Saida);
    }

    // Janela grande, fundo branco e letra grande, para ler a lista com calma.
    void MostrarClientes(string texto)
    {
        var f = new Form
        {
            Text = "Clientes para agir — " + DateTime.Now.ToString("dd/MM HH:mm"), Icon = Icon,
            StartPosition = FormStartPosition.CenterScreen, WindowState = FormWindowState.Maximized,
            MinimumSize = new Size(700, 500), BackColor = Color.White
        };
        var caixa = new RichTextBox
        {
            Dock = DockStyle.Fill, ReadOnly = true, BorderStyle = BorderStyle.None, BackColor = Color.White,
            Font = new Font("Segoe UI", 13f), ForeColor = Color.FromArgb(30, 30, 30), DetectUrls = false
        };
        var margem = new Panel { Dock = DockStyle.Fill, Padding = new Padding(40, 24, 40, 24), BackColor = Color.White };
        margem.Controls.Add(caixa);
        var fechar = new Button { Text = "Fechar", Dock = DockStyle.Bottom, Height = 44, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(31, 122, 90), ForeColor = Color.White, Font = new Font("Segoe UI", 12f, FontStyle.Bold) };
        fechar.Click += (s, e) => f.Close();
        f.Controls.Add(margem);
        f.Controls.Add(fechar);

        var verde = Color.FromArgb(31, 122, 90);
        var cinza = Color.FromArgb(100, 100, 100);
        foreach (var bruta in texto.Replace("\r", "").Split('\n'))
        {
            string l = bruta.TrimEnd();
            string t = l.TrimStart();
            if (t.StartsWith("PRECISAM DE VOCÊ") || t.StartsWith("BOA CHANCE") || t.StartsWith("POUCA OU NENHUMA"))
            {
                Por(caixa, "\n" + t + "\n", new Font("Segoe UI", 17f, FontStyle.Bold), t.StartsWith("PRECISAM") ? Color.FromArgb(185, 28, 28) : verde);
            }
            else if (t.StartsWith("O que fazer:"))
            {
                Por(caixa, "      O que fazer: ", new Font("Segoe UI", 13f, FontStyle.Bold), verde);
                Por(caixa, t.Substring(12).Trim() + "\n", new Font("Segoe UI", 13f, FontStyle.Bold), Color.FromArgb(30, 30, 30));
            }
            else if (t.StartsWith("Por quê:"))
            {
                Por(caixa, "      " + t + "\n\n", new Font("Segoe UI", 12f), cinza);
            }
            else if (t.Length > 2 && char.IsDigit(t[0]) && t.Contains(". "))
            {
                Por(caixa, t + "\n", new Font("Segoe UI", 14f, FontStyle.Bold), Color.FromArgb(30, 30, 30));
            }
            else if (t.StartsWith("- "))
            {
                Por(caixa, "  •  " + t.Substring(2) + "\n", new Font("Segoe UI", 12.5f), Color.FromArgb(30, 30, 30));
            }
            else if (t.Length > 0)
            {
                Por(caixa, t + "\n", new Font("Segoe UI", 12f), cinza);
            }
        }
        caixa.SelectionStart = 0;
        f.Show(this);
    }

    static void Por(RichTextBox caixa, string texto, Font fonte, Color cor)
    {
        caixa.SelectionStart = caixa.TextLength;
        caixa.SelectionLength = 0;
        caixa.SelectionFont = fonte;
        caixa.SelectionColor = cor;
        caixa.AppendText(texto);
    }

    // Caixinha de pergunta com um campo de texto.
    string Perguntar(string tituloJanela, string texto, string valor, bool escondido)
    {
        using (var f = new Form())
        {
            f.Text = tituloJanela; f.Font = Font; f.FormBorderStyle = FormBorderStyle.FixedDialog;
            f.StartPosition = FormStartPosition.CenterParent; f.MinimizeBox = false; f.MaximizeBox = false;
            f.AutoScaleDimensions = new SizeF(96F, 96F); f.AutoScaleMode = AutoScaleMode.Dpi; f.AutoSize = true; f.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            var t = new TableLayoutPanel { AutoSize = true, ColumnCount = 1, Padding = new Padding(14), Dock = DockStyle.Fill };
            var l = new Label { Text = texto, AutoSize = true, MaximumSize = new Size(460, 0), Margin = new Padding(0, 0, 0, 10) };
            var caixa = new TextBox { Text = valor, Width = 460, UseSystemPasswordChar = escondido };
            var linha = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, Dock = DockStyle.Fill, Margin = new Padding(0, 12, 0, 0) };
            var ok = new Button { Text = "OK", DialogResult = DialogResult.OK, Width = 100, Height = 32 };
            var cancelar = new Button { Text = "Cancelar", DialogResult = DialogResult.Cancel, Width = 100, Height = 32 };
            linha.Controls.Add(cancelar); linha.Controls.Add(ok);
            t.Controls.Add(l); t.Controls.Add(caixa); t.Controls.Add(linha);
            f.Controls.Add(t);
            f.AcceptButton = ok; f.CancelButton = cancelar;
            return f.ShowDialog(this) == DialogResult.OK ? caixa.Text : null;
        }
    }
}

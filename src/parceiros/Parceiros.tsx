import { useState } from 'react';
import type { FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROFISSOES, parceiroService } from '@/services/parceiroService';
import type { ParceiroCadastrado } from '@/services/parceiroService';
import { WHATSAPP_NUMBER, WHATSAPP_NUMBER_DISPLAY } from '@/services/whatsapp';

const PASSOS = [
  {
    titulo: 'Você se cadastra',
    texto: 'Preenche o formulário abaixo e recebe na hora o seu link exclusivo.',
  },
  {
    titulo: 'Seu cliente simula a obra',
    texto: 'Você envia o link ao cliente. Ele faz a simulação e o Gabriel cuida de todo o atendimento.',
  },
  {
    titulo: 'Você recebe 20%',
    texto: 'Quando o cliente pagar o Gabriel, você recebe 20% do valor pago.',
  },
];

const REGRAS = [
  'Comissão de 20% sobre o valor que o cliente pagar ao Gabriel, paga depois que o cliente pagar.',
  'Vale para os clientes que chegarem pelo seu link e fecharem o serviço.',
  'Pagamento por Pix, mediante recibo ou nota fiscal.',
  'Tudo combinado em um contrato simples de parceria, enviado após o seu cadastro.',
  'Indique somente com a autorização do cliente.',
];

const ENTREGA = [
  'Regularização da obra na Receita Federal (CNO, SERO e certidão CND)',
  'Redução do INSS conforme a IN RFB 2.021/2021',
  'Parcelamento do saldo do INSS da obra em até 60 vezes',
  'Acompanhamento por 5 anos',
];

function mensagemParaCliente(link: string): string {
  return `Oi! Conheço um especialista em regularização e redução de INSS de obra, o Gabriel Zaneloti. Faça uma simulação gratuita da sua obra por este link e veja uma estimativa de economia: ${link}`;
}

function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export default function Parceiros() {
  const [nome, setNome] = useState('');
  const [profissao, setProfissao] = useState('');
  const [cidade, setCidade] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [aceita, setAceita] = useState(false);
  const [isca, setIsca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState<ParceiroCadastrado | null>(null);
  const [copiado, setCopiado] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (nome.trim().length < 3) return setErro('Informe o seu nome completo.');
    if (!profissao) return setErro('Escolha a sua profissão.');
    if (cidade.trim().length < 2) return setErro('Informe a sua cidade e estado.');
    const digitos = soDigitos(whatsapp);
    if (digitos.length < 10 || digitos.length > 13) return setErro('Informe o WhatsApp com DDD.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Informe um e-mail válido.');
    if (!aceita) return setErro('Marque a caixa para continuar.');

    setEnviando(true);
    try {
      const r = await parceiroService.cadastrar({
        nome: nome.trim(),
        profissao,
        cidade: cidade.trim(),
        whatsapp: digitos,
        email: email.trim(),
        website: isca,
      });
      setPronto(r);
    } catch {
      setErro('Não consegui concluir o cadastro agora. Tente de novo em instantes ou chame o Gabriel no WhatsApp.');
    } finally {
      setEnviando(false);
    }
  }

  async function copiar(chave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      window.setTimeout(() => setCopiado(''), 2500);
    } catch {
      setErro('Não consegui copiar. Selecione o texto e copie manualmente.');
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy-950 py-5">
        <Container className="flex items-center justify-between gap-4">
          <a href="/" className="block">
            <span className="block text-lg font-extrabold text-white">GABRIEL ZANELOTI</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent-400">
              Planejamento Tributário | INSS de Obras
            </span>
          </a>
          <a href="#cadastro" className="btn-primary hidden sm:inline-flex">
            Quero ser parceiro
          </a>
        </Container>
      </header>

      <section className="relative overflow-hidden bg-navy-950 pb-20 pt-10 sm:pb-28 sm:pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(60% 50% at 85% 10%, rgba(147,201,58,0.25) 0%, transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(247,146,15,0.18) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
        <Container className="relative">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
              Programa de parceiros
            </span>
            <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl [text-wrap:balance]">
              Indique obras e receba 20% quando o cliente pagar
            </h1>
            <p className="mt-4 text-base leading-snug text-navy-200 sm:text-lg">
              Para engenheiros, arquitetos, contadores, construtoras e quem acompanha obras. Você indica, o Gabriel cuida da regularização.
            </p>
            <a href="#cadastro" className="btn-primary mt-8 w-full px-8 py-4 text-base shadow-card ring-4 ring-amber-500/25 sm:w-auto">
              Quero ser parceiro
            </a>
            <p className="mt-3 text-sm text-navy-300">Cadastro gratuito. Leva menos de 1 minuto.</p>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Como funciona" title="Três passos simples" />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-lg font-extrabold text-amber-700">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{p.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-navy-600">{p.texto}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-navy-50 py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading align="left" eyebrow="Para o seu cliente" title="O que ele recebe" />
            <ul className="mt-6 space-y-3 text-sm font-semibold text-navy-800">
              {ENTREGA.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-navy-600">
              O cliente continua sendo seu: você segue como o profissional de confiança dele, e o Gabriel cuida da parte do INSS.
            </p>
          </div>
          <div>
            <SectionHeading align="left" eyebrow="Regras claras" title="Como a comissão funciona" />
            <ul className="mt-6 space-y-3 text-sm font-semibold text-navy-800">
              {REGRAS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section id="cadastro" className="scroll-mt-6 py-16 sm:py-20">
        <Container className="max-w-2xl">
          {pronto ? (
            <div className="rounded-xl2 border border-accent-200 bg-accent-50 p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-accent-700">Cadastro recebido</p>
              <h2 className="mt-2 text-2xl font-bold text-navy-900">Pronto, {nome.trim().split(/\s+/)[0]}! Este é o seu link.</h2>
              <p className="mt-3 text-sm text-navy-600">Quem simular a obra por este link fica registrado como indicação sua.</p>

              <div className="mt-5 rounded-xl border border-navy-100 bg-white p-4">
                <p className="break-all text-sm font-semibold text-navy-900">{pronto.link}</p>
                <button type="button" onClick={() => copiar('link', pronto.link)} className="btn-secondary mt-3">
                  {copiado === 'link' ? 'Link copiado!' : 'Copiar link'}
                </button>
              </div>

              <p className="mt-6 text-sm font-semibold text-navy-800">Mensagem pronta para enviar ao cliente:</p>
              <div className="mt-2 rounded-xl border border-navy-100 bg-white p-4 text-sm leading-relaxed text-navy-700">
                {mensagemParaCliente(pronto.link)}
              </div>
              <button type="button" onClick={() => copiar('msg', mensagemParaCliente(pronto.link))} className="btn-outline mt-3">
                {copiado === 'msg' ? 'Mensagem copiada!' : 'Copiar mensagem'}
              </button>

              <p className="mt-6 text-sm leading-relaxed text-navy-600">
                O Gabriel vai te chamar no WhatsApp para enviar o contrato de parceria. Guarde este link: ele é só seu.
              </p>
            </div>
          ) : (
            <>
              <SectionHeading eyebrow="Cadastro" title="Quero ser parceiro" description="Preencha os dados e receba o seu link na hora." />
              <form onSubmit={enviar} className="mt-8 space-y-4" noValidate>
                <div>
                  <label htmlFor="p-nome" className="field-label">Nome completo</label>
                  <input id="p-nome" className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
                </div>
                <div>
                  <label htmlFor="p-prof" className="field-label">Profissão</label>
                  <select id="p-prof" className="field-input" value={profissao} onChange={(e) => setProfissao(e.target.value)}>
                    <option value="">Selecione</option>
                    {PROFISSOES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="p-cidade" className="field-label">Cidade e estado</label>
                  <input id="p-cidade" className="field-input" placeholder="Ex.: Niterói/RJ" value={cidade} onChange={(e) => setCidade(e.target.value)} autoComplete="address-level2" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="p-whats" className="field-label">WhatsApp com DDD</label>
                    <input id="p-whats" className="field-input" inputMode="tel" placeholder="(21) 98521-3949" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" />
                  </div>
                  <div>
                    <label htmlFor="p-email" className="field-label">E-mail</label>
                    <input id="p-email" type="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </div>

                {/* Campo-isca anti-spam: invisível para pessoas. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Site
                    <input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
                  </label>
                </div>

                <label className="flex items-start gap-3 text-sm text-navy-700">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-accent-600" checked={aceita} onChange={(e) => setAceita(e.target.checked)} />
                  <span>
                    Concordo em receber contato do Gabriel sobre o programa de parceiros e li a{' '}
                    <a href="/privacidade.html" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      Política de Privacidade
                    </a>
                    .
                  </span>
                </label>

                {erro && (
                  <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {erro}
                  </p>
                )}

                <button type="submit" disabled={enviando} className="btn-primary w-full px-8 py-4 text-base">
                  {enviando ? 'Enviando...' : 'Quero ser parceiro'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-navy-500">
                Prefere falar direto?{' '}
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Chame o Gabriel no WhatsApp ({WHATSAPP_NUMBER_DISPLAY})
                </a>
              </p>
            </>
          )}
        </Container>
      </section>

      <footer className="border-t border-navy-100 py-8 text-center text-xs text-navy-400">
        © {new Date().getFullYear()} Gabriel Zaneloti. Todo o conteúdo deste site é reservado. ·{' '}
        <a href="/" className="underline">Voltar para o site</a>
      </footer>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-600" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

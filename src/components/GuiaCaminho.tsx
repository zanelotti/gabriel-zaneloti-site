import { useState, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { maskWhatsApp } from '@/utils/formatters';
import { isValidWhatsApp, isValidEmail } from '@/utils/validation';
import { getGuiaDownload, guiaLeadService } from '@/services/guiaLeadService';
import { generateEbookWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

const CONTEUDO_EBOOK = [
  'Como a Receita chega ao valor do INSS da obra — a conta em 4 passos simples',
  'Onde as reduções costumam aparecer: tempo, mão de obra, tipo e tamanho da obra',
  'Os documentos que ajudam (e o que fazer se faltar algum)',
  'O caminho completo, em 6 etapas, até a certidão da obra',
  'Os 5 erros que deixam a conta mais cara',
];

const DOWNLOAD = getGuiaDownload();

/**
 * Seção de captura do e-book gratuito "Como reduzir o INSS da sua obra"
 * (lead magnet): conteúdo educativo real, baseado no mesmo conteúdo técnico
 * usado no restante do site. A pessoa deixa nome, e-mail e WhatsApp, o PDF
 * baixa na hora e, em seguida, aparece o botão "Baixar e-book" (caso o
 * navegador bloqueie o download automático) e os próximos passos.
 */
export function GuiaCaminho() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errors, setErrors] = useState<{ nome?: string; email?: string; whatsapp?: string }>({});
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: { nome?: string; email?: string; whatsapp?: string } = {};
    if (!nome.trim()) nextErrors.nome = 'Informe seu nome.';
    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Informe um e-mail válido.';
    }
    if (!whatsapp.trim()) {
      nextErrors.whatsapp = 'Informe seu WhatsApp.';
    } else if (!isValidWhatsApp(whatsapp)) {
      nextErrors.whatsapp = 'Informe um WhatsApp válido, com DDD.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    trackEvent('ebook_baixado', { origem: 'formulario' });
    guiaLeadService.capture({
      nome: nome.trim(),
      email: email.trim(),
      whatsapp,
      material: 'ebook-reduzir-inss-obra',
    });
    setSent(true);
  };

  return (
    <section id="ebook" className="scroll-mt-20 bg-navy-950 py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            E-book gratuito · PDF
          </span>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Como reduzir o INSS da sua obra
          </h2>
          <p className="mt-4 max-w-lg text-navy-100">
            A conta veio alta e você quer entender o porquê? Neste e-book eu explico, em linguagem simples, como
            a Receita calcula o valor, onde as reduções costumam aparecer e qual é o caminho até a certidão.
          </p>

          <div className="mt-6 flex items-start gap-5">
            <img
              src="/ebook-capa.webp"
              width={360}
              height={511}
              loading="lazy"
              decoding="async"
              alt="Capa do e-book Como reduzir o INSS da sua obra"
              className="h-auto w-28 shrink-0 rounded-lg shadow-card ring-1 ring-white/15 sm:w-36"
            />
            <ul className="space-y-2.5">
              {CONTEUDO_EBOOK.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-navy-100">
                  <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-navy-300">10 páginas · PDF leve, abre bem no celular.</p>
        </div>

        <div className="rounded-xl2 border border-white/10 bg-white/[0.06] p-6 shadow-card sm:p-8">
          {sent ? (
            <div>
              <h3 className="text-xl font-bold text-white">Pronto! Seu e-book está liberado.</h3>
              <p className="mt-2 text-sm text-navy-200">
                O download começou. Se não apareceu nada, toque no botão abaixo.
              </p>

              <a
                href={DOWNLOAD.pdfHref}
                download={DOWNLOAD.pdfDownloadName}
                className="btn-primary mt-5 w-full gap-2 py-4 text-base"
                onClick={() => trackEvent('ebook_baixado', { origem: 'botao_apos_cadastro' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                </svg>
                Baixar e-book (PDF)
              </a>

              <div className="mt-7 border-t border-white/10 pt-6">
                <h4 className="text-base font-bold text-white">Quer saber se a sua obra tem redução?</h4>
                <p className="mt-1 text-sm text-navy-200">A análise inicial é gratuita e sem compromisso.</p>
                <div className="mt-4 grid gap-3">
                  <a
                    href="#calculadora"
                    className="btn-secondary w-full border border-white/20"
                    onClick={() => trackEvent('click_simular', { origem: 'pos_ebook' })}
                  >
                    Fazer a simulação
                  </a>
                  <a
                    href={generateEbookWhatsAppLink(nome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn w-full bg-[#25D366] text-white hover:bg-[#1fb757] active:scale-[0.98]"
                    onClick={() => trackEvent('whatsapp_clicked', { origem: 'pos_ebook' })}
                  >
                    Falar com o Gabriel no WhatsApp
                  </a>
                  <a
                    href="#agendar"
                    className="btn w-full border-2 border-white/30 text-white hover:bg-white/10 active:scale-[0.98]"
                    onClick={() => trackEvent('click_agendar', { origem: 'pos_ebook' })}
                  >
                    Agendar uma consultoria
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h3 className="text-lg font-bold text-white">Baixe agora, sem custo</h3>
              <p className="mt-1 text-sm text-navy-200">Só precisamos do seu nome, e-mail e WhatsApp.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="guia-caminho-nome" className="field-label text-navy-200">
                    Nome
                  </label>
                  <input
                    id="guia-caminho-nome"
                    name="nome"
                    type="text"
                    autoComplete="name"
                    className={`field-input ${errors.nome ? 'field-input-error' : ''}`}
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    aria-invalid={Boolean(errors.nome)}
                  />
                  {errors.nome && <p className="field-error">{errors.nome}</p>}
                </div>

                <div>
                  <label htmlFor="guia-caminho-email" className="field-label text-navy-200">
                    E-mail
                  </label>
                  <input
                    id="guia-caminho-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={`field-input ${errors.email ? 'field-input-error' : ''}`}
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="field-error">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="guia-caminho-whatsapp" className="field-label text-navy-200">
                    WhatsApp com DDD
                  </label>
                  <input
                    id="guia-caminho-whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    className={`field-input ${errors.whatsapp ? 'field-input-error' : ''}`}
                    placeholder="(21) 98521-3949"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(maskWhatsApp(event.target.value))}
                    aria-invalid={Boolean(errors.whatsapp)}
                  />
                  {errors.whatsapp && <p className="field-error">{errors.whatsapp}</p>}
                </div>
              </div>

              <button type="submit" className="btn-primary mt-6 w-full py-4 text-base">
                Baixar e-book grátis
              </button>
              <p className="mt-3 text-center text-[11px] text-navy-300">
                Ao baixar, você aceita receber contato pelo WhatsApp e e-mail sobre este conteúdo. Seus dados não
                são compartilhados com terceiros.
              </p>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}

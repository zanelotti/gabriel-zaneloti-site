import { useState, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { maskWhatsApp } from '@/utils/formatters';
import { isValidWhatsApp } from '@/utils/validation';
import { guiaLeadService } from '@/services/guiaLeadService';
import { trackEvent } from '@/services/analytics';

const ERROS_PREVIA = [
  'Não reunir comprovantes de pagamento da mão de obra',
  'Não registrar a paralisação da obra no SERO',
  'Declarar errado (ou esquecer) as áreas complementares',
  'Interromper a entrega da DCTFWeb durante a execução da obra',
  'Confundir contrato de empreitada total com contrato de administração',
];

/**
 * Seção de captura do "guia gratuito" (lead magnet): conteúdo educativo real,
 * baseado no mesmo conteúdo técnico usado no restante do site, para
 * quem ainda não está pronto para preencher a calculadora completa.
 */
export function GuiaGratuito() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errors, setErrors] = useState<{ nome?: string; whatsapp?: string }>({});
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: { nome?: string; whatsapp?: string } = {};
    if (!nome.trim()) nextErrors.nome = 'Informe seu nome.';
    if (!whatsapp.trim()) {
      nextErrors.whatsapp = 'Informe seu WhatsApp.';
    } else if (!isValidWhatsApp(whatsapp)) {
      nextErrors.whatsapp = 'Informe um WhatsApp válido, com DDD.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    trackEvent('guia_gratuito_baixado', { origem: 'secao_guia' });
    guiaLeadService.capture({ nome: nome.trim(), whatsapp });
    setSent(true);
  };

  return (
    <section className="scroll-mt-20 bg-navy-950 py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Guia gratuito · PDF
          </span>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            5 erros que fazem pessoas físicas pagarem mais INSS de obra
          </h2>
          <p className="mt-4 max-w-lg text-navy-100">
            Ainda não está pronto para simular sua obra? Baixe este material gratuito e descubra, com base nas
            normas da Receita Federal, os erros mais comuns que fazem obras pagarem mais INSS do que deveriam.
          </p>

          <ul className="mt-6 space-y-2.5">
            {ERROS_PREVIA.map((erro) => (
              <li key={erro} className="flex items-start gap-2.5 text-sm text-navy-100">
                <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {erro}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl2 border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur sm:p-8">
          {sent ? (
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-bold text-white">Seu guia já está sendo baixado!</h3>
              <p className="mt-2 text-sm text-navy-200">
                Se o download não começou automaticamente, confira a barra de downloads do seu navegador.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h3 className="text-lg font-bold text-white">Baixe agora, sem custo</h3>
              <p className="mt-1 text-sm text-navy-200">Só precisamos do seu nome e WhatsApp.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="guia-nome" className="field-label text-navy-200">
                    Nome
                  </label>
                  <input
                    id="guia-nome"
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
                  <label htmlFor="guia-whatsapp" className="field-label text-navy-200">
                    WhatsApp com DDD
                  </label>
                  <input
                    id="guia-whatsapp"
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

              <button type="submit" className="btn-primary mt-6 w-full">
                Baixar guia gratuito em PDF
              </button>
              <p className="mt-3 text-center text-[11px] text-navy-300">
                Seus dados não são compartilhados. Você pode ser contatado pelo WhatsApp sobre este conteúdo.
              </p>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}

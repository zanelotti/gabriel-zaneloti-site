import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { BotaoWhatsApp } from '@/components/ui/BotaoWhatsApp';
import { trackEvent } from '@/services/analytics';

const DORES = [
  'Recebi o valor do INSS da obra e não sei se está certo?',
  'Preciso vender, financiar ou averbar o imóvel e falta a certidão (CND)?',
  'Minha obra é antiga e não sei se ainda dá para cobrar tudo isso?',
  'Tenho notas e comprovantes da mão de obra, mas não sei se valem como desconto?',
  'Falta tempo e paciência para lidar sozinho com a Receita, o CNO e o SERO?',
];

/**
 * "Você se identifica?" — o visitante se reconhece em uma das situações e
 * já encontra, na mesma tela, o botão de WhatsApp com a mensagem pronta.
 */
export function Dores() {
  return (
    <section className="scroll-mt-20 py-16 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Será que é o seu caso?" title="Você se identifica com alguma dessas situações?" />

        <ul className="mx-auto mt-10 grid max-w-3xl gap-3">
          {DORES.map((dor) => (
            <li
              key={dor}
              className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-4 shadow-soft sm:p-5"
            >
              <span
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-extrabold text-amber-600"
                aria-hidden="true"
              >
                ?
              </span>
              <span className="text-base font-semibold leading-snug text-navy-800">{dor}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-xl text-center text-lg font-bold text-navy-900">
          Se você respondeu “sim” para alguma, está no lugar certo.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-navy-500">
          A análise inicial é gratuita e sem compromisso. Conte rapidinho sobre a sua obra.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BotaoWhatsApp origem="dores" texto="Quero falar sobre a minha obra" className="w-full sm:w-auto" />
          <a
            href="#calculadora"
            className="btn-outline w-full sm:w-auto"
            onClick={() => trackEvent('click_simular', { origem: 'dores' })}
          >
            Fazer a simulação
          </a>
        </div>
      </Container>
    </section>
  );
}

import { Container } from '@/components/ui/Container';
import { WHATSAPP_NUMBER_DISPLAY } from '@/services/whatsapp';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contato" className="scroll-mt-20 bg-navy-950 py-14 text-navy-300">
      <Container>
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="text-lg font-extrabold text-white">GABRIEL ZANELOTI</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent-400">
              Planejamento Tributário | INSS de Obras
            </p>
            <p className="mt-4 text-sm leading-relaxed">Redução de INSS de obras — consultoria especializada.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Contato</p>
            <p className="mt-3 text-sm">
              E-mail:{' '}
              <a href="mailto:comercial.mfzeng@gmail.com" className="hover:text-accent-400">
                comercial.mfzeng@gmail.com
              </a>
            </p>
            <p className="mt-1 text-sm">
              WhatsApp:{' '}
              <a
                href={`https://wa.me/5521985213949`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent-400"
              >
                {WHATSAPP_NUMBER_DISPLAY}
              </a>
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Institucional</p>
            {/* Espaço reservado para inclusão futura da Política de Privacidade e dos Termos de Uso */}
            <p className="mt-3 text-sm text-navy-500">Política de Privacidade (em breve)</p>
            <p className="mt-1 text-sm text-navy-500">Termos de Uso (em breve)</p>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-navy-500">
          © {year} Gabriel Zaneloti. Todos os direitos reservados.
        </div>
      </Container>
    </footer>
  );
}

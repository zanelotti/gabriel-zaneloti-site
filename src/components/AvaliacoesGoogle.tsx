import { useEffect, useRef } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { CREDENCIAIS } from '@/data/credenciais';
import { trackEvent } from '@/services/analytics';

/** Aceita o código inteiro do Trustindex (<script ... loader.js?ID>) ou só o ID. */
function idDoTrustindex(codigo: string): string {
  const t = codigo.trim();
  const m = t.match(/loader\.js\?([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : '';
}

const PREVIA = import.meta.env.VITE_PREVIA === '1';

/** (Não usado no momento: as avaliações ficam no topo, em Provas.tsx.) Avaliações reais do Google, direto no site (quadro do Trustindex, que atualiza sozinho). */
export function AvaliacoesGoogle() {
  const caixa = useRef<HTMLDivElement>(null);
  const id = idDoTrustindex(CREDENCIAIS.trustindex);

  useEffect(() => {
    const alvo = caixa.current;
    if (!id || !alvo || alvo.childElementCount > 0) return;
    // O Trustindex desenha o quadro no lugar onde o script é colocado.
    const script = document.createElement('script');
    script.src = `https://cdn.trustindex.io/loader.js?${id}`;
    script.async = true;
    script.defer = true;
    alvo.appendChild(script);
  }, [id]);

  if (!id && !PREVIA) return null;

  return (
    <section id="avaliacoes" aria-label="Avaliações no Google" className="scroll-mt-20 bg-white py-14 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow="Avaliações no Google"
          title="O que os clientes dizem"
          description="Avaliações reais, publicadas pelos próprios clientes no Google."
        />
        <div className="mx-auto mt-10 max-w-5xl">
          {id ? (
            <div ref={caixa} />
          ) : (
            <div className="flex min-h-[14rem] items-center justify-center rounded-xl2 border-2 border-dashed border-navy-200 bg-navy-50 p-6 text-center text-sm text-navy-500">
              Aqui entra o quadro de avaliações do Google (Trustindex), com estrelas, nome e texto de cada cliente.
              <br />
              Ele aparece assim que o código do Trustindex for colocado.
            </div>
          )}
        </div>
        {CREDENCIAIS.googleAvaliacoes && (
          <p className="mt-8 text-center">
            <a
              href={CREDENCIAIS.googleAvaliacoes}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
              onClick={() => trackEvent('click_avaliacoes_google', { origem: 'secao_avaliacoes' })}
            >
              Ver todas no Google
            </a>
          </p>
        )}
      </Container>
    </section>
  );
}

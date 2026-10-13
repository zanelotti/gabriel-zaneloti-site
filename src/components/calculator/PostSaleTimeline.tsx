interface TimelineStepProps {
  numero: number;
  titulo: string;
  descricao: string;
  isLast: boolean;
  feito?: boolean;
}

function TimelineStep({ numero, titulo, descricao, isLast, feito = false }: TimelineStepProps) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && (
        <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-navy-100" aria-hidden="true" />
      )}
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
          feito ? 'bg-accent-500' : 'bg-navy-900'
        }`}
      >
        {feito ? (
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          numero
        )}
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-bold text-navy-900">{titulo}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-navy-500">{descricao}</p>
      </div>
    </li>
  );
}

/**
 * Linha do tempo do que acontece depois que o lead decide seguir em frente —
 * reduz a ansiedade de "e agora, o que acontece?" logo após ver o resultado,
 * quando o visitante está mais próximo de decidir.
 */
export function PostSaleTimeline() {
  return (
    <div className="mt-6 rounded-xl2 border border-navy-100 bg-white p-6">
      <p className="section-eyebrow">O que acontece depois</p>
      <ol className="mt-5">
        <TimelineStep numero={1} titulo="Simulação gratuita" descricao="Você já fez." isLast={false} feito />
        <TimelineStep
          numero={2}
          titulo="Conversa de 10 min"
          descricao="Confirmo o potencial real de economia."
          isLast={false}
        />
        <TimelineStep
          numero={3}
          titulo="Levantamento documental"
          descricao="Datas, área, notas fiscais e mão de obra da sua obra."
          isLast={false}
        />
        <TimelineStep
          numero={4}
          titulo="Protocolo na Receita Federal"
          descricao="Conduzo o trâmite e a aplicação das reduções cabíveis, do início ao fim."
          isLast={false}
        />
        <TimelineStep
          numero={5}
          titulo="Obra regularizada"
          descricao="Você recebe a confirmação da regularização. Meu honorário é uma porcentagem calculada sobre a economia comprovada."
          isLast
        />
      </ol>
    </div>
  );
}

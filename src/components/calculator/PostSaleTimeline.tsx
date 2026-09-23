interface TimelineStepProps {
  numero: number;
  titulo: string;
  descricao: string;
  isLast: boolean;
}

function TimelineStep({ numero, titulo, descricao, isLast }: TimelineStepProps) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-navy-100" aria-hidden="true" />
      )}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
        {numero}
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-bold text-navy-900">{titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-500">{descricao}</p>
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
    <div className="mt-8 rounded-xl2 border border-navy-100 bg-white p-6">
      <p className="section-eyebrow">O que acontece depois</p>
      <h4 className="mt-1 text-lg font-bold text-navy-900">Do diagnóstico à sua obra regularizada</h4>
      <ol className="mt-6">
        <TimelineStep
          numero={1}
          titulo="Diagnóstico gratuito (você já está aqui)"
          descricao="A estimativa acima já é o primeiro passo — sem custo e sem compromisso."
          isLast={false}
        />
        <TimelineStep
          numero={2}
          titulo="Conversa no WhatsApp"
          descricao="Alinhamos os detalhes da sua obra e confirmamos, com mais precisão, o potencial real de economia."
          isLast={false}
        />
        <TimelineStep
          numero={3}
          titulo="Levantamento documental"
          descricao="Reunimos e organizamos a documentação necessária (datas, área, notas fiscais, comprovantes de mão de obra)."
          isLast={false}
        />
        <TimelineStep
          numero={4}
          titulo="Protocolo junto à Receita Federal"
          descricao="Conduzo o trâmite de regularização e aplicação das reduções legais cabíveis, do início ao fim."
          isLast={false}
        />
        <TimelineStep
          numero={5}
          titulo="Obra regularizada"
          descricao="Você recebe a confirmação da regularização. O honorário é uma porcentagem sobre a economia comprovada — ou, quando não há redução a aplicar, um valor mínimo conforme a complexidade do processo."
          isLast
        />
      </ol>
    </div>
  );
}

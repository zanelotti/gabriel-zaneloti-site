interface RiskFreeBadgeProps {
  /** 'dark' para fundos escuros (navy-950), 'light' para fundos claros/brancos. */
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Selo "risco zero" — reforça visualmente que o diagnóstico inicial é
 * gratuito e sem compromisso. Reutilizado no Hero e na CTA final para
 * aparecer perto de toda decisão de simular/agendar.
 */
export function RiskFreeBadge({ variant = 'light', className = '' }: RiskFreeBadgeProps) {
  const tone =
    variant === 'dark'
      ? 'border-accent-400/30 bg-white/5 text-navy-100'
      : 'border-accent-200 bg-accent-50 text-navy-700';

  return (
    <div className={`inline-flex flex-col gap-1.5 rounded-2xl border px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 ${tone} ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-600">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
        Diagnóstico 100% gratuito
      </span>
      <span className="hidden text-navy-300 sm:inline">·</span>
      <span className="text-sm font-semibold">Sem compromisso — agende sua consultoria</span>
    </div>
  );
}

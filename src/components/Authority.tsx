import { useEffect, useRef, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency } from '@/utils/formatters';

/** Seção de autoridade/resultados — usa apenas o número de economia acumulada divulgado no site de referência. */
export function Authority() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const animatedValue = useCountUp(1_000_000, 1600, isVisible);

  return (
    <section className="bg-navy-950 py-16 sm:py-20" ref={containerRef}>
      <Container className="text-center">
        <span className="section-eyebrow text-accent-400">Resultados</span>
        <p className="mt-3 text-lg text-navy-200">
          Desde o início das atividades já ajudei a reduzir mais de
        </p>
        <p className="mt-2 text-4xl font-extrabold text-accent-400 sm:text-5xl">
          {formatCurrency(animatedValue).replace(/,00$/, '')}
        </p>
        <p className="mt-2 text-sm text-navy-300">em contribuições de INSS de obras — e só vai aumentando.</p>
      </Container>
    </section>
  );
}

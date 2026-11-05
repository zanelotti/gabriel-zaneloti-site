import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

interface CarregarQuandoPertoProps {
  id: string;
  /** Altura reservada enquanto o conteúdo não carrega (evita a página "pular" quando ele aparece). */
  alturaMinima: string;
  children: ReactNode;
}

/**
 * Só monta (e portanto só baixa) o conteúdo quando o visitante chega perto
 * dele na rolagem — deixa o site mais leve no celular. Se o navegador não
 * suportar IntersectionObserver, monta na hora.
 */
export function CarregarQuandoPerto({ id, alturaMinima, children }: CarregarQuandoPertoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [perto, setPerto] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (perto) return;
    const alvo = ref.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setPerto(true);
          observador.disconnect();
        }
      },
      { rootMargin: '900px 0px' }
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [perto]);

  const reserva = <div id={id} style={{ minHeight: alturaMinima }} aria-hidden="true" />;

  if (!perto) return <div ref={ref}>{reserva}</div>;
  return <Suspense fallback={reserva}>{children}</Suspense>;
}

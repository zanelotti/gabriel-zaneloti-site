import type { ServiceItem } from '@/data/services';

interface ServiceIconProps {
  icone: ServiceItem['icone'];
  className?: string;
}

const PATHS: Record<ServiceItem['icone'], string> = {
  reducao: 'M4 17l5-5 4 4 7-8M20 8V4h-4',
  regularizacao: 'M9 12l2 2 4-4M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z',
  cno: 'M4 5h16v3H4zM6 8v11h12V8M9 12h6M9 15h6',
  sero: 'M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2 2m-9 9l-2 2m13 0l-2-2m-9-9l-2-2M12 8a4 4 0 100 8 4 4 0 000-8z',
  darf: 'M6 3h9l3 3v15H6zM15 3v3h3M9 12h6M9 15h6M9 9h3',
  cnd: 'M12 3l7 3v5c0 4.5-3 7.7-7 10-4-2.3-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
  planejamento: 'M4 19V5m5 14V9m5 10V13m5 6V7',
};

export function ServiceIcon({ icone, className = 'h-6 w-6' }: ServiceIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d={PATHS[icone]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

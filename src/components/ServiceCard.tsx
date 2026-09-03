import type { ServiceItem } from '@/data/services';
import { ServiceIcon } from '@/components/ui/ServiceIcon';

interface ServiceCardProps {
  service: ServiceItem;
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="card flex flex-col items-start">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
        <ServiceIcon icone={service.icone} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-navy-900">{service.titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-500">{service.descricao}</p>
    </div>
  );
}

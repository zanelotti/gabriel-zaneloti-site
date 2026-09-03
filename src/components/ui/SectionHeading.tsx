interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}

export function SectionHeading({ eyebrow, title, description, align = 'center' }: SectionHeadingProps) {
  const alignment = align === 'center' ? 'text-center items-center mx-auto' : 'text-left items-start';

  return (
    <div className={`flex flex-col ${alignment} max-w-2xl animate-fade-in-up`}>
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="section-title">{title}</h2>
      {description && <p className="mt-4 text-base text-navy-500 sm:text-lg">{description}</p>}
    </div>
  );
}

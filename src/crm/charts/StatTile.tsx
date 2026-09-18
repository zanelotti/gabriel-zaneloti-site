interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  accent?: 'navy' | 'accent' | 'red';
}

const ACCENT_CLASSES: Record<NonNullable<StatTileProps['accent']>, string> = {
  navy: 'text-navy-900',
  accent: 'text-accent-600',
  red: 'text-red-600',
};

export function StatTile({ label, value, hint, accent = 'navy' }: StatTileProps) {
  return (
    <div className="rounded-xl2 border border-navy-100 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold ${ACCENT_CLASSES[accent]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-navy-400">{hint}</p>}
    </div>
  );
}

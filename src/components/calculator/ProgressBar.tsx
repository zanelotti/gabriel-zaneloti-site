interface ProgressBarProps {
  currentStep: 1 | 2 | 3;
  totalSteps?: number;
}

export function ProgressBar({ currentStep, totalSteps = 3 }: ProgressBarProps) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-navy-500">
        <span>
          Etapa {currentStep} de {totalSteps}
        </span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-navy-100"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Etapa ${currentStep} de ${totalSteps}`}
      >
        <div
          className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

import type { PropsWithChildren } from 'react';

interface ContainerProps {
  className?: string;
}

export function Container({ children, className = '' }: PropsWithChildren<ContainerProps>) {
  return <div className={`container-page ${className}`}>{children}</div>;
}

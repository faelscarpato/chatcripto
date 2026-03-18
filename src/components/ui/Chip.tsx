import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

export function Chip({ selected = false, icon, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn('ui-chip', selected && 'ui-chip--selected', className)}
      aria-pressed={selected}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

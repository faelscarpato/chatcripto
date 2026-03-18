import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  tone?: 'default' | 'danger';
}

export function Card({
  interactive = false,
  selected = false,
  tone = 'default',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'ui-card',
        interactive && 'ui-card--interactive',
        selected && 'ui-card--selected',
        tone === 'danger' && 'ui-card--danger',
        className,
      )}
      {...props}
    />
  );
}

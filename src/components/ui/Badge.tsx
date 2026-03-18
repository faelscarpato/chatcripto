import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'muted' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ children, variant = 'muted', icon, className }: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge--${variant}`, className)}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

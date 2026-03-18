import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type IconButtonVariant = 'secondary' | 'ghost' | 'danger' | 'primary';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
}

export function IconButton({
  icon,
  label,
  variant = 'secondary',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('ui-button', 'ui-icon-button', `ui-button--${variant}`, 'ui-button--sm', className)}
      {...props}
    >
      {icon}
    </button>
  );
}

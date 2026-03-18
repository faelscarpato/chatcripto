import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      className={cn(
        'ui-button',
        `ui-button--${variant}`,
        size !== 'md' && `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </button>
  );
}

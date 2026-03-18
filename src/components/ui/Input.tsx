import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, trailing, className, id, ...props },
  ref,
) {
  return (
    <label className="ui-field" htmlFor={id}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      <span className={cn('ui-input', error && 'ui-input--error')}>
        {icon ? <span className="ui-input__icon">{icon}</span> : null}
        <input ref={ref} id={id} className={cn('ui-input__control', className)} {...props} />
        {trailing ? <span className="ui-input__trailing">{trailing}</span> : null}
      </span>
      {error ? (
        <span className="ui-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ui-field__hint">{hint}</span>
      ) : null}
    </label>
  );
});

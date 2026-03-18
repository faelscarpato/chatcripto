import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
}

export function PasswordField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: PasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <label className="ui-field" htmlFor={fieldId}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      <span className={cn('ui-input', error && 'ui-input--error')}>
        <span className="ui-input__icon">
          <LockKeyhole size={18} />
        </span>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={cn('ui-input__control', className)}
          {...props}
        />
        <button
          type="button"
          className="ui-input__trailing"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
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
}

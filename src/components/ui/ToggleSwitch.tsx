import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  icon,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn('ui-toggle', checked && 'ui-toggle--checked')}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="settings-row__meta">
        <span className="settings-row__title">
          {icon} {label}
        </span>
        {description ? <span className="settings-row__description">{description}</span> : null}
      </span>
      <span className="ui-toggle__track" aria-hidden="true">
        <span className="ui-toggle__thumb" />
      </span>
    </button>
  );
}

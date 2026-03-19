import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface RadioCardProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  badge?: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function RadioCard({
  icon: Icon,
  title,
  description,
  checked,
  badge,
  disabled = false,
  className,
  onClick,
}: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      className={cn('ui-radio-card', checked && 'ui-radio-card--selected', className)}
      onClick={onClick}
    >
      <span className="ui-radio-card__body">
        {Icon ? (
          <span className="ui-radio-card__icon">
            <Icon size={20} />
          </span>
        ) : null}
        <span className="ui-radio-card__copy">
          <span className="ui-radio-card__title-row">
            <span className="ui-radio-card__title">{title}</span>
            {badge}
          </span>
          <span className="ui-radio-card__description">{description}</span>
        </span>
      </span>
      <span className="ui-radio-card__indicator" aria-hidden="true">
        {checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </span>
    </button>
  );
}

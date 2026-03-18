import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface PrivacyCardOptionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  badge?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function PrivacyCardOption({
  icon: Icon,
  title,
  description,
  selected = false,
  badge,
  trailing,
  disabled = false,
  className,
  onClick,
}: PrivacyCardOptionProps) {
  return (
    <button
      type="button"
      className={cn('privacy-option', selected && 'privacy-option--selected', className)}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div className="privacy-option__body">
        <span className="privacy-option__icon">
          <Icon size={20} />
        </span>
        <div className="section-stack section-stack--sm privacy-option__copy">
          <div className="toolbar-row privacy-option__title-row">
            <h3 className="privacy-option__title">{title}</h3>
            {badge}
          </div>
          <p className="privacy-option__text">{description}</p>
        </div>
      </div>
      {trailing ? <span className="privacy-option__trailing">{trailing}</span> : null}
    </button>
  );
}

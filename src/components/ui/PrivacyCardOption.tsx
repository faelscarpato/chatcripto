import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface PrivacyCardOptionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}

export function PrivacyCardOption({
  icon: Icon,
  title,
  description,
  selected = false,
  badge,
  onClick,
}: PrivacyCardOptionProps) {
  return (
    <Card className="privacy-option" interactive selected={selected} onClick={onClick}>
      <div className="toolbar-row">
        <span className="privacy-option__icon">
          <Icon size={20} />
        </span>
        {badge}
      </div>
      <div className="section-stack section-stack--sm">
        <h3 className="privacy-option__title">{title}</h3>
        <p className="privacy-option__text">{description}</p>
      </div>
    </Card>
  );
}

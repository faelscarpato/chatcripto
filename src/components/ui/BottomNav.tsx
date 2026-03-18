import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        {items.map(({ id, label, icon: Icon, active = false, onClick }) => (
          <button
            key={id}
            type="button"
            className={cn('bottom-nav__item', active && 'bottom-nav__item--active')}
            aria-current={active ? 'page' : undefined}
            onClick={onClick}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

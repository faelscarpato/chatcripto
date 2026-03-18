import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface TopbarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function Topbar({ title, subtitle, leading, trailing, className }: TopbarProps) {
  return (
    <header className={cn('topbar', className)}>
      <div className="topbar__inner">
        <div className="topbar__slot">
          {leading}
          <div className="topbar__meta">
            <h2 className="topbar__title">{title}</h2>
            {subtitle ? <p className="topbar__subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {trailing ? <div className="topbar__slot">{trailing}</div> : null}
      </div>
    </header>
  );
}

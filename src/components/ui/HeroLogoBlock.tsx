import type { ReactNode } from 'react';
import { ShieldEllipsis } from 'lucide-react';
import { Card } from './Card';

interface HeroLogoBlockProps {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  meta?: ReactNode;
}

export function HeroLogoBlock({ eyebrow, title, subtitle, meta }: HeroLogoBlockProps) {
  return (
    <Card className="hero-logo">
      <p className="eyebrow">{eyebrow}</p>
      <div className="hero-logo__brand">
        <span className="hero-logo__mark" aria-hidden="true">
          <ShieldEllipsis size={28} />
        </span>
        <div>
          <h1 className="hero-logo__title">{title}</h1>
          <p className="hero-logo__subtitle">{subtitle}</p>
        </div>
      </div>
      {meta ? <div className="hero-logo__meta">{meta}</div> : null}
    </Card>
  );
}

import { ArrowRight, Eye, Link2, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { OnlineCount } from './OnlineCount';
import { TimerPill } from './TimerPill';

interface RoomCardProps {
  name: string;
  roomId: string;
  category: string;
  ageGroup: string;
  summary: string;
  featureLabel: string;
  accessLabel: string;
  presenceCount: number;
  presenceLabel?: string;
  timerLabel?: string;
  selected?: boolean;
  directAccess?: boolean;
  locked?: boolean;
  joinForm?: ReactNode;
  onShare?: () => void;
  onRequestJoin: () => void;
}

export function RoomCard({
  name,
  roomId,
  category,
  ageGroup,
  summary,
  featureLabel,
  accessLabel,
  presenceCount,
  presenceLabel = 'pessoas com acesso',
  timerLabel = '20m',
  selected = false,
  directAccess = false,
  locked = false,
  joinForm,
  onShare,
  onRequestJoin,
}: RoomCardProps) {
  return (
    <Card className="room-card room-card--home" interactive selected={selected}>
      <div className="room-card__hero">
        <div className="room-card__identity">
          <span className="room-card__logo" aria-hidden="true">
            <img src="/chatcripto-logo.png" alt="" />
          </span>
          <div className="section-stack section-stack--sm room-card__copy">
            <div className="toolbar-row room-card__headline">
              <h3 className="room-card__title">{name}</h3>
              <Badge variant={ageGroup === '+18' ? 'danger' : 'success'}>{ageGroup}</Badge>
            </div>
            <p className="room-card__summary">{summary}</p>
          </div>
        </div>
        <TimerPill label={timerLabel} />
      </div>

      <div className="room-card__chips">
        <Badge variant="muted" icon={<Eye size={12} />}>
          {featureLabel}
        </Badge>
        <Badge variant={directAccess ? 'primary' : 'info'}>
          {accessLabel}
        </Badge>
      </div>

      <div className="room-card__footer">
        <div className="room-card__meta-line room-card__meta-line--stacked">
          <OnlineCount count={presenceCount} label={presenceLabel} />
          <div className="room-card__meta-line">
            <span className="room-card__meta-item">
              {directAccess ? <ShieldCheck size={14} /> : <LockKeyhole size={14} />}
              <span>{locked ? 'Entrada com senha' : 'Chave salva'}</span>
            </span>
            <span className="room-card__meta-item">
              <span className="room-card__dot" />
              <span>{category}</span>
            </span>
            <span className="room-card__meta-item room-card__meta-item--id">#{roomId.slice(0, 6)}</span>
          </div>
        </div>

        <div className="room-card__actions">
          {onShare ? (
            <Button
              variant="ghost"
              size="sm"
              className="room-card__share"
              onClick={onShare}
              leadingIcon={<Link2 size={15} />}
            >
              Convidar
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="room-card__cta"
            onClick={onRequestJoin}
            leadingIcon={<Users size={16} />}
            trailingIcon={<ArrowRight size={14} />}
          >
            {selected ? 'Confirmar' : directAccess ? 'Entrar' : 'Abrir'}
          </Button>
        </div>
      </div>

      {joinForm}
    </Card>
  );
}

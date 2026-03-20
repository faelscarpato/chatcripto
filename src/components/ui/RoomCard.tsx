import { ArrowRight, Heart, Link2, LockKeyhole, ShieldCheck, Star, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RoomVisibility } from '../../types/rooms';
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
  visibility: RoomVisibility;
  messageTtlMinutes: number;
  description?: string | null;
  presenceCount: number;
  presenceLabel?: string;
  selected?: boolean;
  directAccess?: boolean;
  locked?: boolean;
  isFavorite?: boolean;
  isOwner?: boolean;
  joinForm?: ReactNode;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  onRequestJoin: () => void;
}

const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  public: 'Publica',
  unlisted: 'Nao listada',
  personal: 'Pessoal',
};

export function RoomCard({
  name,
  roomId,
  category,
  ageGroup,
  visibility,
  messageTtlMinutes,
  description,
  presenceCount,
  presenceLabel = 'pessoas com acesso',
  selected = false,
  directAccess = false,
  locked = false,
  isFavorite = false,
  isOwner = false,
  joinForm,
  onShare,
  onToggleFavorite,
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
              <Badge variant={visibility}>{VISIBILITY_LABELS[visibility]}</Badge>
              <Badge variant={ageGroup === '+18' ? 'danger' : 'success'}>{ageGroup}</Badge>
              {isOwner ? <Badge variant="owner">Owner</Badge> : null}
              {isFavorite ? <Badge variant="favorite">Favorita</Badge> : null}
            </div>
            <p className="room-card__summary">
              {description?.trim() || `Sala ${VISIBILITY_LABELS[visibility].toLowerCase()} na categoria ${category.toLowerCase()}.`}
            </p>
          </div>
        </div>
        <TimerPill minutes={messageTtlMinutes} variant="strong" />
      </div>

      <div className="room-card__chips">
        <Badge variant="muted">{category}</Badge>
        <Badge variant={directAccess ? 'primary' : 'info'}>
          {directAccess ? 'Acesso salvo' : locked ? 'Senha exigida' : 'Acesso sob demanda'}
        </Badge>
      </div>

      <div className="room-card__footer">
        <div className="room-card__meta-line room-card__meta-line--stacked">
          <OnlineCount count={presenceCount} label={presenceLabel} />
          <div className="room-card__meta-line">
            <span className="room-card__meta-item">
              {directAccess ? <ShieldCheck size={14} /> : <LockKeyhole size={14} />}
              <span>{locked ? 'Entrada com senha' : 'Chave salva na sessao'}</span>
            </span>
            <span className="room-card__meta-item">
              <span className="room-card__dot" />
              <span>{category}</span>
            </span>
            <span className="room-card__meta-item room-card__meta-item--id">#{roomId.slice(0, 6)}</span>
          </div>
        </div>

        <div className="room-card__actions room-card__actions--triple">
          {onToggleFavorite ? (
            <Button
              variant="secondary"
              size="sm"
              className="room-card__secondary"
              onClick={onToggleFavorite}
              leadingIcon={isFavorite ? <Heart size={15} /> : <Star size={15} />}
            >
              {isFavorite ? 'Favorita' : 'Favoritar'}
            </Button>
          ) : null}
          {onShare ? (
            <Button
              variant="secondary"
              size="sm"
              className="room-card__share"
              onClick={onShare}
              leadingIcon={<Link2 size={15} />}
            >
              Convidar
            </Button>
          ) : null}
          <Button
            variant="primary"
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

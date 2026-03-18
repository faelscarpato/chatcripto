import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';

interface RoomCardProps {
  name: string;
  roomId: string;
  category: string;
  ageGroup: string;
  selected?: boolean;
  directAccess?: boolean;
  locked?: boolean;
  joinForm?: ReactNode;
  onRequestJoin: () => void;
}

export function RoomCard({
  name,
  roomId,
  category,
  ageGroup,
  selected = false,
  directAccess = false,
  locked = false,
  joinForm,
  onRequestJoin,
}: RoomCardProps) {
  return (
    <Card className="room-card" interactive selected={selected}>
      <div className="room-card__header">
        <div className="room-card__meta">
          <span className="hero-logo__mark" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="section-stack section-stack--sm">
            <div className="toolbar-row">
              <h3 className="room-card__title">{name}</h3>
              <Badge variant={ageGroup === '+18' ? 'danger' : 'success'}>{ageGroup}</Badge>
              {locked ? <Badge variant="warning">Lock</Badge> : null}
            </div>
            <p className="room-card__description">Sala #{roomId.slice(0, 8)} • {category}</p>
          </div>
        </div>
        <Button
          variant={directAccess ? 'primary' : 'secondary'}
          size="sm"
          onClick={onRequestJoin}
          leadingIcon={directAccess ? <ShieldCheck size={16} /> : <KeyRound size={16} />}
          trailingIcon={<ArrowRight size={16} />}
        >
          {directAccess ? 'Entrar direto' : selected ? 'Confirmar chave' : 'Desbloquear'}
        </Button>
      </div>
      <div className="room-card__footer">
        <div className="toolbar-row">
          <Badge variant="info">{category}</Badge>
          <Badge variant={directAccess ? 'primary' : 'muted'}>
            {directAccess ? 'Acesso salvo' : 'Senha necessária'}
          </Badge>
        </div>
      </div>
      {joinForm}
    </Card>
  );
}

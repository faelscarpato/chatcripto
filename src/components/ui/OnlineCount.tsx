import { RadioTower } from 'lucide-react';

interface OnlineCountProps {
  count: number;
  label?: string;
}

export function OnlineCount({ count, label = 'salas ativas' }: OnlineCountProps) {
  return (
    <span className="online-count">
      <RadioTower size={14} />
      <span>{count} {label}</span>
    </span>
  );
}

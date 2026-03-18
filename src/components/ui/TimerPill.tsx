import { Clock3 } from 'lucide-react';

interface TimerPillProps {
  label: string;
}

export function TimerPill({ label }: TimerPillProps) {
  return (
    <span className="timer-pill">
      <Clock3 size={14} />
      <span>{label}</span>
    </span>
  );
}

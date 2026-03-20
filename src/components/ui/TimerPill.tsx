import { Clock3 } from 'lucide-react';

interface TimerPillProps {
  label?: string;
  minutes?: number;
  variant?: 'subtle' | 'strong';
}

export function TimerPill({ label, minutes, variant = 'subtle' }: TimerPillProps) {
  const resolvedLabel = label ?? `${minutes ?? 20} min`;

  return (
    <span className={`timer-pill timer-pill--${variant}`}>
      <Clock3 size={14} />
      <span>{resolvedLabel}</span>
    </span>
  );
}

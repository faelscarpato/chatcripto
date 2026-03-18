import { Card } from './Card';

interface StatsCardProps {
  label: string;
  value: string;
  description: string;
}

export function StatsCard({ label, value, description }: StatsCardProps) {
  return (
    <Card className="stats-card">
      <p className="eyebrow">{label}</p>
      <p className="stats-card__value">{value}</p>
      <p className="stats-card__description">{description}</p>
    </Card>
  );
}

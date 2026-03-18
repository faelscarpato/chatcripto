import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';

interface SearchBarPillProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function SearchBarPill({ label = 'Buscar salas', ...props }: SearchBarPillProps) {
  return (
    <div className="search-pill">
      <Input
        aria-label={label}
        placeholder="Buscar sala protegida"
        icon={<Search size={18} />}
        {...props}
      />
    </div>
  );
}

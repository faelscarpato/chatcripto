import { Search } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Input } from './Input';

interface SearchBarPillProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  trailing?: ReactNode;
}

export function SearchBarPill({ label = 'Buscar salas', trailing, ...props }: SearchBarPillProps) {
  return (
    <div className="search-pill">
      <Input
        aria-label={label}
        placeholder="Buscar sala protegida"
        icon={<Search size={18} />}
        trailing={trailing}
        {...props}
      />
    </div>
  );
}

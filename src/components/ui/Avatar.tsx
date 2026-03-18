import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  fallback: string;
  size?: AvatarSize;
  src?: string;
  alt?: string;
  icon?: ReactNode;
}

export function Avatar({ fallback, size = 'md', src, alt, icon }: AvatarProps) {
  const content = src ? <img src={src} alt={alt ?? fallback} /> : icon ?? fallback.slice(0, 1).toUpperCase();

  return <span className={cn('ui-avatar', `ui-avatar--${size}`)}>{content}</span>;
}

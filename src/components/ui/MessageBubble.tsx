import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface MessageBubbleProps {
  own: boolean;
  author: string;
  time: string;
  content: ReactNode;
  senderVariant: number;
}

export function MessageBubble({ own, author, time, content, senderVariant }: MessageBubbleProps) {
  return (
    <div className="message-stack" data-own={own}>
      <article className={cn('message-bubble', `message-bubble--sender-${senderVariant}`)} data-own={own}>
        <div className="message-bubble__header">
          <span className="message-bubble__author">{author}</span>
          <span className="message-bubble__time">{time}</span>
        </div>
        <div className="message-bubble__surface">
          <div className="message-bubble__content">{content}</div>
        </div>
      </article>
    </div>
  );
}

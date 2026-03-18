import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { cn } from '../../lib/cn';

interface MessageBubbleProps {
  own: boolean;
  author: string;
  time: string;
  content: ReactNode;
  senderVariant: number;
  showAvatar?: boolean;
}

export function MessageBubble({
  own,
  author,
  time,
  content,
  senderVariant,
  showAvatar = true,
}: MessageBubbleProps) {
  return (
    <div className="message-stack" data-own={own}>
      <article className={cn('message-bubble', `message-bubble--sender-${senderVariant}`)} data-own={own}>
        <div className="message-bubble__body">
          {showAvatar ? (
            <span className="message-bubble__avatar">
              <Avatar fallback={author} size="sm" />
            </span>
          ) : (
            <span className="message-bubble__avatar-spacer" aria-hidden="true" />
          )}

          <div className="message-bubble__column">
            <div className="message-bubble__header">
              <span className="message-bubble__author">{author}</span>
            </div>
            <div className="message-bubble__surface">
              <div className="message-bubble__content">{content}</div>
              <div className="message-bubble__footer">
                <span className="message-bubble__time">{time}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

import { Camera, Send } from 'lucide-react';
import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { IconButton } from './IconButton';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFileClick: () => void;
  sending?: boolean;
  uploading?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onFileClick,
  sending = false,
  uploading = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className="composer" onSubmit={onSubmit}>
      <IconButton
        icon={<Camera size={18} />}
        label="Anexar mídia"
        onClick={onFileClick}
        variant="ghost"
        className="composer__media-button"
        disabled={uploading}
      />
      <div className="composer__field">
        <textarea
          ref={textareaRef}
          className="composer__textarea"
          rows={1}
          placeholder="Escreva uma mensagem..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Mensagem"
        />
        <span className="composer__timer">20 min</span>
      </div>
      <IconButton
        icon={<Send size={18} />}
        label="Enviar mensagem"
        type="submit"
        variant={value.trim() ? 'primary' : 'secondary'}
        className="composer__send-button"
        disabled={!value.trim() || sending || uploading}
      />
    </form>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Camera, EyeOff, ShieldAlert, TimerReset } from 'lucide-react';
import { Badge, Button } from './ui';

interface ViewOnceProps {
  mediaId: string;
  onViewed: (id: string) => void;
  decryptMedia: (id: string) => Promise<string>;
  mode?: 'once' | '30s';
  durationSeconds?: number | null;
}

export function ViewOnceBubble({
  mediaId,
  onViewed,
  decryptMedia,
  mode = 'once',
  durationSeconds,
}: ViewOnceProps) {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'viewing' | 'destroyed'>('hidden');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds ?? null);
  const hasDestroyedRef = useRef(false);

  const destroyMedia = () => {
    if (hasDestroyedRef.current) {
      return;
    }

    hasDestroyedRef.current = true;
    setStatus('destroyed');
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    onViewed(mediaId);
  };

  useEffect(() => {
    if (status !== 'viewing') {
      return;
    }

    const handleProtectedExit = () => {
      destroyMedia();
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleDragStart = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        destroyMedia();
      }
    };

    window.addEventListener('blur', handleProtectedExit);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('dragstart', handleDragStart);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleProtectedExit);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, imageUrl]);

  useEffect(() => {
    if (status !== 'viewing' || mode !== '30s' || !durationSeconds) {
      return;
    }

    setSecondsLeft(durationSeconds);
    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current === null) {
          return durationSeconds;
        }

        if (current <= 1) {
          window.clearInterval(intervalId);
          destroyMedia();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [status, mode, durationSeconds, imageUrl]);

  const handleOpenMedia = async () => {
    if (status !== 'hidden') {
      return;
    }

    setStatus('loading');

    try {
      const url = await decryptMedia(mediaId);
      hasDestroyedRef.current = false;
      setImageUrl(url);
      setSecondsLeft(durationSeconds ?? null);
      setStatus('viewing');
    } catch (error) {
      console.error('Failed to decrypt media:', error);
      setStatus('hidden');
      alert('Falha ao descriptografar mídia.');
    }
  };

  const handleCloseAndDestroy = () => {
    destroyMedia();
  };

  if (status === 'destroyed') {
    return (
      <div className="media-viewed">
        <EyeOff size={16} />
        <span>Foto visualizada e removida</span>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="media-gate"
        onClick={handleOpenMedia}
        loading={status === 'loading'}
        leadingIcon={status !== 'loading' ? <Camera size={18} /> : null}
      >
        {status === 'loading'
          ? 'Descriptografando mídia'
          : mode === '30s'
            ? 'Visualizar foto por 30s'
            : 'Visualizar foto view-once'}
      </Button>

      {status === 'viewing' ? (
        <div className="media-modal" onContextMenu={(event) => event.preventDefault()}>
          <div className="media-modal__inner media-modal__inner--protected">
            <div className="media-modal__header">
              <div className="toolbar-row">
                <Badge variant="warning">Confidencial</Badge>
                <Badge variant="info">
                  {mode === '30s' ? <TimerReset size={14} /> : <ShieldAlert size={14} />}
                  {mode === '30s' ? `${secondsLeft ?? durationSeconds ?? 30}s` : 'Fecha ao sair'}
                </Badge>
              </div>
              <Button variant="danger" onClick={handleCloseAndDestroy}>
                {mode === '30s' ? 'Encerrar antes' : 'Fechar e apagar'}
              </Button>
            </div>

            <div className="media-modal__frame">
              <img
                src={imageUrl!}
                alt="Mídia segura"
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
                draggable={false}
              />
            </div>

            <div className="media-modal__footer">
              <p className="text-muted">
                {mode === '30s'
                  ? 'A imagem será apagada automaticamente ao fim da contagem ou ao perder foco.'
                  : 'A imagem será apagada ao fechar, trocar de aba ou perder o foco da janela.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

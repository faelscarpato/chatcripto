import { useState } from 'react';
import { Camera, EyeOff } from 'lucide-react';
import { Badge, Button } from './ui';

interface ViewOnceProps {
  mediaId: string;
  onViewed: (id: string) => void;
  decryptMedia: (id: string) => Promise<string>;
}

export function ViewOnceBubble({ mediaId, onViewed, decryptMedia }: ViewOnceProps) {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'viewing' | 'destroyed'>('hidden');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleOpenMedia = async () => {
    if (status !== 'hidden') {
      return;
    }

    setStatus('loading');

    try {
      const url = await decryptMedia(mediaId);
      setImageUrl(url);
      setStatus('viewing');
    } catch (error) {
      console.error('Failed to decrypt media:', error);
      setStatus('hidden');
      alert('Falha ao descriptografar mídia.');
    }
  };

  const handleCloseAndDestroy = () => {
    setStatus('destroyed');
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    onViewed(mediaId);
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
        {status === 'loading' ? 'Descriptografando mídia' : 'Visualizar foto view-once'}
      </Button>

      {status === 'viewing' ? (
        <div className="media-modal">
          <div className="media-modal__inner">
            <div className="media-modal__header">
              <Badge variant="warning">Confidencial</Badge>
              <Button variant="danger" onClick={handleCloseAndDestroy}>
                Fechar e apagar
              </Button>
            </div>

            <div className="media-modal__frame">
              <img
                src={imageUrl!}
                alt="Mídia segura"
                onContextMenu={(event) => event.preventDefault()}
              />
            </div>

            <div className="media-modal__footer">
              <p className="text-muted">Esta imagem será apagada assim que você encerrar a visualização.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

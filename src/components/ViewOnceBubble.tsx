import React, { useState } from 'react';
import { Camera, EyeOff, Loader2 } from 'lucide-react';

interface ViewOnceProps {
  mediaId: string;
  onViewed: (id: string) => void; // Função que chama o Supabase para deletar
  decryptMedia: (id: string) => Promise<string>; // Função para baixar e descriptografar
}

export const ViewOnceBubble: React.FC<ViewOnceProps> = ({ mediaId, onViewed, decryptMedia }) => {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'viewing' | 'destroyed'>('hidden');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleOpenMedia = async () => {
    if (status !== 'hidden') return;
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
      setImageUrl(null); // Limpa da memória RAM
    }
    onViewed(mediaId); // Dispara ação para deletar do banco/storage
  };

  if (status === 'destroyed') {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-2xl text-slate-500 border border-slate-700/50 italic text-sm w-fit">
        <EyeOff size={16} /> Foto visualizada
      </div>
    );
  }

  return (
    <>
      {/* Botão no Chat */}
      <button 
        onClick={handleOpenMedia}
        className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 transition-colors rounded-2xl text-amber-400 border border-amber-500/30 w-fit"
      >
        {status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        <span className="font-medium text-sm">
          {status === 'loading' ? 'Descriptografando...' : 'Toque para visualizar foto'}
        </span>
      </button>

      {/* Modal Tela Cheia (Renderizado no nível superior) */}
      {status === 'viewing' && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md flex justify-between items-center absolute top-0 p-4">
            <span className="text-amber-400 text-xs font-mono animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Confidencial
            </span>
            <button 
              onClick={handleCloseAndDestroy}
              className="px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-medium hover:bg-slate-700"
            >
              Fechar & Apagar
            </button>
          </div>
          
          <img 
            src={imageUrl!} 
            alt="Secure Media" 
            className="max-w-full max-h-[80vh] rounded-lg select-none pointer-events-none" 
            onContextMenu={(e) => e.preventDefault()} // Impede botão direito
          />
          
          <p className="absolute bottom-10 text-slate-400 text-sm">
            Esta imagem será apagada ao fechar.
          </p>
        </div>
      )}
    </>
  );
};

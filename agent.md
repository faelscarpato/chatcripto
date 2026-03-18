Relatório de UI/UX Redesign - ChatCript 🛡️ (Atualizado: Filtro Etário e View-Once)1. RESUMOContexto: O ChatCript é um PWA de chat em tempo real com criptografia end-to-end, construído com React, Supabase e Vite.Foco do Redesign: Elevar a percepção de segurança do usuário, implementando privacidade efêmera (fotos que se apagam) e moderação preventiva (salas segregadas por idade).Diretriz Visual: "Cyber-Minimalismo". Interface Dark Mode, tipografia monoespaçada para criptografia, e novos indicadores visuais efêmeros (ícones de timer e censura).Assunções: O Supabase será configurado para gerenciar a idade via Auth Metadata e Row Level Security (RLS), garantindo que a regra de idade seja inviolável no backend, refletindo na UI.2. DIAGNÓSTICOProblema Incorreto/MVPEvidência (Arquivos)ImpactoSeveridadeCorreção (Redesign)Mistura de PúblicosRoomList.tsx lista tudo sem filtro.Risco de exposição de menores a conteúdos inadequados.CríticaImplementar AgeGate no Auth e abas/filtros automáticos no RoomList.Risco de Vazamento de MídiaAusência de envio de arquivos ou envio persistente.Quebra de privacidade/confiança do usuário.AltaAdicionar fluxo "View-Once" com deleção automática (UI e Supabase Storage).Falta de Feedback de Segurançacrypto.ts roda no background sem UI clara.Usuário não sabe se a conversa está realmente segura.AltaAdicionar indicadores visuais de descriptografia em tempo real.Acessibilidade em Dark ModeContraste padrão costuma falhar em fundos escuros.Dificuldade de leitura (WCAG).MédiaUso de paleta de cinzas calculada (ex: fundo slate-900, texto slate-200).3. ESTRATÉGIAPrincípio 1: "Comunidades Seguras" (Age Separation): A idade não é apenas um filtro visual, mas uma barreira arquitetural. A UI deve deixar claro em qual "Zona Etária" o usuário está (ex: selos visuais "+18" ou "Livre").Princípio 2: "Privacidade Efêmera" (View-Once): Imagens nunca devem renderizar diretamente no fluxo do chat. Elas aparecem como um botão de "Mídia Oculta". O usuário precisa ativamente clicar/segurar para ver. Fechou, apagou.Trade-off: Criptografar imagens no cliente antes de enviar ao Supabase Storage e descriptografar na visualização consome mais CPU mobile, mas é vital para garantir que nem o servidor veja a mídia.4. PROPOSTA DE UIFluxo de Auth (Auth.tsx):Adição de um seletor de Data de Nascimento obrigatório.Tela de "Verificando Idade" e atribuição do perfil (ex: Teen Zone ou Adult Zone).Layout RoomList.tsx:Header exibe a categoria do usuário.Salas possuem Badges (selos coloridos) indicando a classificação indicativa.Fluxo de Mídia View-Once (Chat.tsx):Input: Ícone de clipe/câmera. Ao selecionar a foto, um toggle com ícone de relógio ("Visualização Única") é ativado por padrão.Chat Bubble (Recebimento): Um botão grande escrito "📷 Foto (Toque para ver)".Interação: Ao tocar, abre um modal tela-cheia com fundo preto. Uma barra de progresso no topo corre por 10 segundos ou até fechar.Estado Final: O botão no chat muda para "Ícone de olho cortado - Visualizada" em cinza e o botão fica desabilitado.5. DESIGN SYSTEM (Tokens)Cores Novas:Age-18Plus: #EF4444 (Red 500) - Selos e avisos para maiores.Age-Teen: #3B82F6 (Blue 500) - Selos para conteúdo adolescente.Ephemeral: #F59E0B (Amber 500) - Cor temática para itens que vão desaparecer (ícones de timer).Espaçamento e Componentes:Modal View-Once: Ocupa 100dvh e 100vw, bloqueando o resto da interface.Inputs: Botões de ação secundária (anexo) devem ter mínimo de 44x44px.6. COMPONENTES NECESSÁRIOSAgeGateSelector: Componente de calendário/input no registro com validação visual imediata da faixa etária.ViewOnceBubble: Componente de chat que gerencia a máquina de estados da foto: [Recebido -> Descriptografando -> Visualizando -> Apagado].MediaUploader: Botão acoplado ao input de texto para gerenciar compressão de imagem no cliente (Canvas API) antes da criptografia.7. STACK TECNOLÓGICA (Recomendações Atualizadas)RecursoFerramenta RecomendadaMotivoEstilização/UITailwind CSS + Lucide IconsDesenvolvimento ágil e ícones perfeitos para cadeados/timers.Compressão de Imagembrowser-image-compressionReduzir o peso antes de criptografar (vital para performance mobile).Gerenciamento de EstadoZustandFacilita a passagem da faixa etária do usuário por toda a aplicação.Segurança BackendSupabase RLS & StorageRLS impede leitura de salas erradas. Storage para hospedar a foto temporariamente.8. SNIPPET: Componente de Foto View-OnceComo a UI deve lidar com a imagem de visualização única no fluxo do chat:import React, { useState } from 'react';
import { Camera, EyeOff, Loader2 } from 'lucide-react';

interface ViewOnceProps {
  mediaId: string;
  onViewed: (id: string) => void; // Função que chama o Supabase para deletar
}

export const ViewOnceBubble: React.FC<ViewOnceProps> = ({ mediaId, onViewed }) => {
  const [status, setStatus] = useState<'hidden' | 'loading' | 'viewing' | 'destroyed'>('hidden');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleOpenMedia = async () => {
    if (status !== 'hidden') return;
    setStatus('loading');
    
    // Simula: 1. Baixar do Supabase Storage -> 2. Descriptografar no Client
    setTimeout(() => {
      setImageUrl('[https://via.placeholder.com/400x600?text=Decrypted+Image](https://via.placeholder.com/400x600?text=Decrypted+Image)');
      setStatus('viewing');
    }, 1500);
  };

  const handleCloseAndDestroy = () => {
    setStatus('destroyed');
    setImageUrl(null); // Limpa da memória RAM
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
9. PLANO DE IMPLEMENTAÇÃO E RISCOSPasso 1 (Backend - Supabase): * Adicionar coluna age_group na tabela de perfis de usuário.Configurar RLS (Row Level Security) para que o SELECT nas salas exija correspondência com o age_group.Criar bucket no Storage com lifecycle rule (apagar tudo com mais de 24h, caso o usuário receba e não abra).Passo 2 (Frontend - UI):Modificar Auth.tsx para solicitar idade.Criar o UI de abas/categorias no RoomList.tsx.Passo 3 (Criptografia e Mídia):Atualizar crypto.ts para suportar ArrayBuffer/Blob, permitindo criptografar arquivos de imagem, não apenas texto.Integrar o componente ViewOnceBubble no Chat.tsx.RISCO TÉCNICO: Usuários podem tirar Print Screen da tela (captura de tela). O PWA na web não consegue bloquear prints nativamente. É importante educar o usuário de que o View-Once apaga os dados do servidor, mas capturas locais fogem do controle do app.10. CHECKLIST QA (Quality Assurance)$$ $$ Separação Etária: Uma conta de 15 anos consegue, via alteração de URL ou API direta, acessar uma sala +18? (Testar RLS no Supabase).$$ $$ Efemeridade: Após fechar a imagem View-Once, ela realmente some do Supabase Storage? A URL gerada foi invalidada?$$ $$ Segurança Client-side: Ao inspecionar o elemento de rede (DevTools), a imagem trafegada está cifrada (ex: base64 embaralhado) antes de chegar na tela?$$ $$ Prevenção de Cache: O src da imagem usa objetos Blob locais (URL.createObjectURL()) para evitar que o navegador faça cache do arquivo em disco?
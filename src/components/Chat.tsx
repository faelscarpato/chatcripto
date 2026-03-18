import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, ArrowLeft, Clock, ShieldCheck, User as UserIcon, MoreVertical, Camera, Loader2 } from 'lucide-react';
import { encryptMessage, decryptMessage, encryptData, base64ToUint8Array } from '../lib/crypto';
import { ViewOnceBubble } from './ViewOnceBubble';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  encrypted_content: string;
  iv: string;
  is_view_once?: boolean;
  media_id?: string;
  created_at: string;
  decrypted_content?: string;
}

interface ChatProps {
  room: { id: string; name: string; key: CryptoKey };
  onLeave: () => void;
}

export default function Chat({ room, onLeave }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchMessages();

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const msg = payload.new as Message;
          
          // Processamento assíncrono da mensagem recebida
          const processNewMessage = async () => {
            if (!msg.is_view_once) {
              msg.decrypted_content = await decryptMessage(msg.encrypted_content, msg.iv, room.key);
            }
            
            setMessages((prev) => {
              // Evita duplicados se a mensagem já foi adicionada pela atualização otimista
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          };
          
          processNewMessage();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });

    if (data) {
      const decrypted = await Promise.all(
        data.map(async (msg) => ({
          ...msg,
          decrypted_content: msg.is_view_once 
            ? undefined 
            : await decryptMessage(msg.encrypted_content, msg.iv, room.key),
        }))
      );
      setMessages(decrypted);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    const content = newMessage;
    const { encrypted, iv } = await encryptMessage(content, room.key);
    setNewMessage('');

    // Optimistic Update: Add message locally first
    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: user.id,
      encrypted_content: encrypted,
      iv,
      created_at: new Date().toISOString(),
      decrypted_content: content
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { error } = await supabase.from('messages').insert([
      {
        id: optimisticMsg.id, // Use the same ID
        room_id: room.id,
        user_id: user.id,
        encrypted_content: encrypted,
        iv,
      },
    ]);

    if (error) {
      alert(error.message);
      setNewMessage(content);
    }
    setIsSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || isUploading) return;

    // Validação de tamanho: 5MB (5 * 1024 * 1024 bytes)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('O arquivo é muito grande! O limite máximo é de 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const mediaId = crypto.randomUUID();
    
    try {
      const buffer = await file.arrayBuffer();
      const { encrypted, iv } = await encryptData(buffer, room.key);
      
      // Adiciona mensagem otimista no chat (com ícone de loading)
      const optimisticMediaMsg: Message = {
        id: crypto.randomUUID(),
        room_id: room.id,
        user_id: user.id,
        encrypted_content: '[View-Once Media]',
        iv,
        is_view_once: true,
        media_id: mediaId,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, optimisticMediaMsg]);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('ephemeral-media')
        .upload(`${room.id}/${mediaId}`, base64ToUint8Array(encrypted), {
          contentType: 'application/octet-stream',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Insert message record
      const { error: msgError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          user_id: user.id,
          encrypted_content: '[View-Once Media]',
          iv,
          is_view_once: true,
          media_id: mediaId
        },
      ]);

      if (msgError) throw msgError;

    } catch (error: any) {
      alert('Erro ao enviar mídia: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const decryptMedia = async (mediaId: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('ephemeral-media')
      .download(`${room.id}/${mediaId}`);

    if (error) throw error;
    
    // IMPORTANTE: Usar arrayBuffer() para dados binários, não text()
    const encryptedBuffer = await data.arrayBuffer();
    const message = messages.find(m => m.media_id === mediaId);
    if (!message) throw new Error('Message not found');

    // Precisamos descriptografar o buffer diretamente
    const ivBuffer = base64ToUint8Array(message.iv);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer as any,
      },
      room.key,
      encryptedBuffer as any
    );

    return URL.createObjectURL(new Blob([decryptedBuffer]));
  };

  const handleMediaViewed = async (mediaId: string) => {
    // Delete from storage
    await supabase.storage.from('ephemeral-media').remove([`${room.id}/${mediaId}`]);
    
    // Update message in DB or just let it stay as "Viewed"
    const message = messages.find(m => m.media_id === mediaId);
    if (message) {
      await supabase.from('messages').delete().eq('id', message.id);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-indigo-600/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <button 
            onClick={onLeave} 
            className="p-2 hover:bg-slate-800/50 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-900/20">
              {room.name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5 leading-none mb-1">
                {room.name} <ShieldCheck size={14} className="text-emerald-500" />
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chat Seguro</span>
                <span className="mx-1">•</span>
                <Clock size={10} className="text-indigo-400" />
                <span>Auto-Destruição: 20m</span>
              </div>
            </div>
          </div>
        </div>
        <button className="p-2 text-slate-500 hover:text-white transition-colors">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <div className="p-4 bg-slate-800 rounded-full">
              <ShieldCheck size={40} className="text-indigo-400" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white uppercase tracking-widest text-xs">Criptografia Ativa</p>
              <p className="text-sm text-slate-400 max-w-[200px]">Nenhuma mensagem ainda. O que for dito aqui, morre aqui.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === user?.id;
            const prevMsg = messages[idx - 1];
            const isSameUser = prevMsg?.user_id === msg.user_id;
            
            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
                  isMe ? "items-end" : "items-start",
                  isSameUser ? "mt-[-16px]" : "mt-2"
                )}
              >
                {!isSameUser && (
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">
                    {isMe ? 'Você' : 'Membro'}
                  </span>
                )}
                <div
                  className={cn(
                    "group relative max-w-[85%] sm:max-w-[70%] px-4 py-2.5 shadow-lg transition-all",
                    isMe 
                      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-indigo-900/20" 
                      : "bg-slate-800/80 glass text-slate-100 rounded-2xl rounded-tl-none border border-slate-700/50",
                    msg.is_view_once && "bg-transparent shadow-none border-none p-0"
                  )}
                >
                  {msg.is_view_once ? (
                    <ViewOnceBubble 
                      mediaId={msg.media_id!} 
                      onViewed={handleMediaViewed} 
                      decryptMedia={decryptMedia}
                    />
                  ) : (
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{msg.decrypted_content}</p>
                  )}
                  
                  {/* Subtle Hover Timestamp */}
                  <div className={cn(
                    "absolute top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-2 text-[10px] font-bold text-slate-500",
                    isMe ? "right-full" : "left-full"
                  )}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                {!isSameUser && isMe === false && (
                  <div className="mt-1 flex items-center gap-1 opacity-40">
                    <UserIcon size={8} className="text-slate-400" />
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{new Date(msg.created_at).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={scrollRef} className="h-4" />
      </div>

      {/* Input Section */}
      <footer className="p-4 pb-8 sm:pb-4 glass border-t border-slate-800/50">
        <form 
          onSubmit={sendMessage} 
          className="max-w-4xl mx-auto flex gap-2 items-end bg-slate-800/40 hover:bg-slate-800/60 p-2 rounded-2xl border border-slate-700/50 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all duration-300"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-xl transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
          </button>
          
          <textarea
            rows={1}
            placeholder="Sussurre algo seguro..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e as any);
              }
            }}
            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-slate-100 placeholder:text-slate-500 text-sm sm:text-base resize-none max-h-32"
          />
          <button
            type="submit"
            className={cn(
              "p-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:scale-100",
              newMessage.trim() ? "bg-indigo-600 text-white shadow-indigo-900/40" : "bg-slate-700 text-slate-500"
            )}
            disabled={!newMessage.trim() || isSending}
          >
            <Send size={20} className={cn(isSending && "animate-pulse")} />
          </button>
        </form>
        <div className="max-w-4xl mx-auto mt-2 px-2 flex items-center justify-between opacity-30 pointer-events-none">
          <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 font-mono">AES-256 GCM Encrypted</span>
          <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400 font-mono">Zero-Log Policy</span>
        </div>
      </footer>
    </div>
  );
}

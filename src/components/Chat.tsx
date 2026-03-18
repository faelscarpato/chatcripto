import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';
import { base64ToUint8Array, decryptMessage, encryptData, encryptMessage } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import { ViewOnceBubble } from './ViewOnceBubble';
import {
  Badge,
  Card,
  Composer,
  IconButton,
  MessageBubble,
  SettingsRow,
  StatsCard,
  TimerPill,
  Topbar,
} from './ui';

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

const MESSAGE_TTL_MS = 20 * 60 * 1000;
const SENDER_VARIANT_COUNT = 6;

function isMessageExpired(message: Pick<Message, 'created_at'>) {
  return Date.now() - new Date(message.created_at).getTime() >= MESSAGE_TTL_MS;
}

function pruneExpiredMessages<T extends Pick<Message, 'created_at'>>(messages: T[]) {
  return messages.filter((message) => !isMessageExpired(message));
}

function getSenderVariant(userId: string) {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % SENDER_VARIANT_COUNT;
}

function getChatDividerLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date());
}

export default function Chat({ room, onLeave }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    void fetchMessages();

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const msg = payload.new as Message;

          const processNewMessage = async () => {
            if (!msg.is_view_once) {
              msg.decrypted_content = await decryptMessage(msg.encrypted_content, msg.iv, room.key);
            }

            setMessages((prev) => {
              if (prev.some((item) => item.id === msg.id)) {
                return prev;
              }
              return pruneExpiredMessages([...prev, msg]);
            });
          };

          void fetchUsernames([msg.user_id]);
          void processNewMessage();
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, room.key]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessages((prev) => pruneExpiredMessages(prev));
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

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
      void fetchUsernames(data.map((message) => message.user_id));
      const decrypted = await Promise.all(
        data.map(async (msg) => ({
          ...msg,
          decrypted_content: msg.is_view_once
            ? undefined
            : await decryptMessage(msg.encrypted_content, msg.iv, room.key),
        })),
      );
      setMessages(pruneExpiredMessages(decrypted));
    }
  };

  const fetchUsernames = async (userIds: string[]) => {
    const uniqueMissingIds = [...new Set(userIds)].filter((id) => id && !usernames[id]);
    if (uniqueMissingIds.length === 0) {
      return;
    }

    const { data } = await supabase.from('profiles').select('id, username').in('id', uniqueMissingIds);
    if (!data) {
      return;
    }

    setUsernames((prev) => {
      const next = { ...prev };
      for (const profile of data) {
        next[profile.id] = profile.username;
      }
      return next;
    });
  };

  const getAuthorLabel = (messageUserId: string) => {
    if (messageUserId === user?.id) {
      return 'Voce';
    }

    return usernames[messageUserId] ?? `Membro ${messageUserId.slice(0, 4)}`;
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || !user || isSending) {
      return;
    }

    setIsSending(true);
    const content = newMessage;
    const { encrypted, iv } = await encryptMessage(content, room.key);
    setNewMessage('');

    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: user.id,
      encrypted_content: encrypted,
      iv,
      created_at: new Date().toISOString(),
      decrypted_content: content,
    };
    setMessages((prev) => pruneExpiredMessages([...prev, optimisticMsg]));

    const { error } = await supabase.from('messages').insert([
      {
        id: optimisticMsg.id,
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || isUploading) {
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('O arquivo é muito grande! O limite máximo é de 5MB.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    const mediaId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    try {
      const buffer = await file.arrayBuffer();
      const { encrypted, iv } = await encryptData(buffer, room.key);

      const optimisticMediaMsg: Message = {
        id: messageId,
        room_id: room.id,
        user_id: user.id,
        encrypted_content: '[View-Once Media]',
        iv,
        is_view_once: true,
        media_id: mediaId,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => pruneExpiredMessages([...prev, optimisticMediaMsg]));

      const { error: uploadError } = await supabase.storage
        .from('ephemeral-media')
        .upload(`${room.id}/${mediaId}`, base64ToUint8Array(encrypted), {
          contentType: 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: msgError } = await supabase.from('messages').insert([
        {
          id: messageId,
          room_id: room.id,
          user_id: user.id,
          encrypted_content: '[View-Once Media]',
          iv,
          is_view_once: true,
          media_id: mediaId,
        },
      ]);

      if (msgError) {
        throw msgError;
      }
    } catch (error: any) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId && message.media_id !== mediaId));
      alert('Erro ao enviar mídia: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const decryptMedia = async (mediaId: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('ephemeral-media')
      .download(`${room.id}/${mediaId}`);

    if (error) {
      throw error;
    }

    const encryptedBuffer = await data.arrayBuffer();
    const message = messages.find((item) => item.media_id === mediaId);
    if (!message) {
      throw new Error('Message not found');
    }

    const ivBuffer = base64ToUint8Array(message.iv);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer as any,
      },
      room.key,
      encryptedBuffer as any,
    );

    return URL.createObjectURL(new Blob([decryptedBuffer]));
  };

  const handleMediaViewed = async (mediaId: string) => {
    await supabase.storage.from('ephemeral-media').remove([`${room.id}/${mediaId}`]);

    setMessages((prev) => prev.filter((message) => message.media_id !== mediaId));
    await supabase.from('messages').delete().eq('media_id', mediaId);
  };

  return (
    <div className="page-shell chat-page">
      <Topbar
        className="chat-topbar"
        title={<span>{room.name}</span>}
        subtitle={
          <span className="toolbar-row text-offline">
            <LockKeyhole size={14} />
            <span>Sala protegida e efemera</span>
          </span>
        }
        leading={<IconButton icon={<ArrowLeft size={18} />} label="Voltar" onClick={onLeave} />}
        trailing={<TimerPill label="20 min" />}
      />

      <main className="page-container chat-main chat-layout">
        <section className="chat-thread">
          <div className="chat-content-panel">
            <div className="chat-scroll section-stack">
              {messages.length === 0 ? (
                <Card className="empty-state">
                  <Badge variant="info">Criptografia ativa</Badge>
                  <h3 className="topbar__title">Nenhuma mensagem ainda</h3>
                  <p className="text-muted">
                    O que for enviado aqui expira em 20 minutos e fica cifrado em trânsito e repouso.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="chat-divider" aria-hidden="true">
                    <span className="chat-divider__line" />
                    <span className="chat-divider__label">{getChatDividerLabel()}</span>
                    <span className="chat-divider__line" />
                  </div>
                  {messages.map((msg, idx) => {
                    const isMe = msg.user_id === user?.id;
                    const prevMsg = messages[idx - 1];
                    const isSameUser = prevMsg?.user_id === msg.user_id;

                    return (
                      <div key={msg.id} className={cn(isSameUser && 'section-stack section-stack--sm')}>
                        <MessageBubble
                          own={isMe}
                          author={getAuthorLabel(msg.user_id)}
                          time={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          senderVariant={getSenderVariant(msg.user_id)}
                          showAvatar={!isSameUser}
                          content={
                            msg.is_view_once ? (
                              <ViewOnceBubble
                                mediaId={msg.media_id!}
                                onViewed={handleMediaViewed}
                                decryptMedia={decryptMedia}
                              />
                            ) : (
                              <p>{msg.decrypted_content}</p>
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={scrollRef} />
            </div>
          </div>
        </section>

        <aside className="chat-aside">
          <StatsCard label="Retenção" value="20m" description="Mensagens textuais e mídia somem após o ciclo efêmero." />
          <StatsCard label="Uploads" value="5MB" description="Mídia view-once com limite atual de cinco megabytes." />
          <Card className="section-stack">
            <p className="eyebrow">Contexto da sala</p>
            <SettingsRow
              title="Proteção da chave"
              description="Derivação local por sala via Web Crypto antes de ler ou enviar mensagens."
              icon={<ShieldCheck size={18} />}
            />
            <SettingsRow
              title="Privacidade efêmera"
              description="Fotos view-once são removidas do storage assim que visualizadas."
              icon={<Sparkles size={18} />}
            />
          </Card>
        </aside>
      </main>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="sr-only"
      />

      <div className="chat-composer-bar">
        <div className="chat-composer-inner">
          <Composer
            value={newMessage}
            onChange={setNewMessage}
            onSubmit={sendMessage}
            onFileClick={() => fileInputRef.current?.click()}
            sending={isSending}
            uploading={isUploading}
          />
        </div>
      </div>
    </div>
  );
}

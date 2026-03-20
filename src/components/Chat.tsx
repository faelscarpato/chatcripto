import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Link2, LockKeyhole, Share2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { base64ToUint8Array, decryptMessage, encryptData, encryptMessage } from '../lib/crypto';
import { DEFAULT_PROFILE_EMOJI, normalizeProfileEmoji } from '../lib/profileEmoji';
import { buildRoomInviteUrl, copyRoomInvite, shareRoomInvite } from '../lib/share';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import type { ActiveRoom, RoomVisibility } from '../types/rooms';
import { ViewOnceBubble } from './ViewOnceBubble';
import {
  Badge,
  Button,
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
  expires_at?: string | null;
  message_type?: 'user' | 'system' | null;
  metadata?: Record<string, unknown> | null;
  is_view_once?: boolean;
  media_id?: string;
  media_type?: string;
  media_view_mode?: 'once' | '30s' | null;
  media_view_seconds?: number | null;
  created_at: string;
  decrypted_content?: string;
}

interface ChatProps {
  room: ActiveRoom;
  onLeave: () => void;
}

const SENDER_VARIANT_COUNT = 6;

const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  public: 'Publica',
  unlisted: 'Nao listada',
  personal: 'Pessoal',
};

function getRoomTtlMs(room: ActiveRoom) {
  return room.messageTtlMinutes * 60 * 1000;
}

function resolveMessageExpiry(message: Pick<Message, 'expires_at' | 'created_at' | 'is_view_once'>, roomTtlMs: number) {
  if (message.expires_at) {
    return new Date(message.expires_at).getTime();
  }

  const fallbackMs = message.is_view_once ? 24 * 60 * 60 * 1000 : roomTtlMs;
  return new Date(message.created_at).getTime() + fallbackMs;
}

function isMessageExpired(message: Pick<Message, 'expires_at' | 'created_at' | 'is_view_once'>, roomTtlMs: number) {
  return Date.now() >= resolveMessageExpiry(message, roomTtlMs);
}

function pruneExpiredMessages<T extends Pick<Message, 'expires_at' | 'created_at' | 'is_view_once'>>(
  messages: T[],
  roomTtlMs: number,
) {
  return messages.filter((message) => !isMessageExpired(message, roomTtlMs));
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

function detectImageMimeType(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  return null;
}

function formatMediaUploadError(error: { message?: string; statusCode?: string | number } | null | undefined) {
  const message = error?.message?.trim() || 'Falha desconhecida no upload da midia.';
  const normalized = message.toLowerCase();
  const statusCode = `${error?.statusCode ?? ''}`;

  if (
    statusCode === '400' ||
    normalized.includes('bucket') ||
    normalized.includes('storage') ||
    normalized.includes('mime') ||
    normalized.includes('row-level security')
  ) {
    return `${message} Verifique se o bucket "ephemeral-media" e as policies de storage foram aplicados no Supabase.`;
  }

  return message;
}

async function uploadEncryptedMedia(path: string, payload: Blob) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sessao expirada. Entre novamente para enviar fotos.');
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/ephemeral-media/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: payload,
  });

  if (!response.ok) {
    const responseText = (await response.text()).trim();
    const details = responseText || `HTTP ${response.status}`;
    throw new Error(`HTTP ${response.status}: ${details}`);
  }
}

export default function Chat({ room, onLeave }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { username: string; profile_emoji: string }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mediaProtectionMode, setMediaProtectionMode] = useState<'once' | '30s'>('once');
  const [privacyShieldActive, setPrivacyShieldActive] = useState(false);
  const [privacyShieldReason, setPrivacyShieldReason] = useState<'focus' | 'screenshot' | null>(null);

  const roomTtlMs = getRoomTtlMs(room);
  const inviteUrl = buildRoomInviteUrl(room.id);
  const roomPassword = sessionStorage.getItem(`room_key_${room.id}`) ?? '';
  const visibilityLabel = VISIBILITY_LABELS[room.visibility];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
    void fetchMessages();

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const msg = payload.new as Message;

          const processNewMessage = async () => {
            if (!msg.is_view_once && msg.message_type !== 'system') {
              msg.decrypted_content = await decryptMessage(msg.encrypted_content, msg.iv, room.key);
            } else if (!msg.is_view_once) {
              msg.decrypted_content = msg.encrypted_content;
            }

            setMessages((prev) => {
              if (prev.some((item) => item.id === msg.id)) {
                return prev;
              }
              return pruneExpiredMessages([...prev, msg], roomTtlMs);
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
  }, [room.id, room.key, roomTtlMs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessages((prev) => pruneExpiredMessages(prev, roomTtlMs));
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [roomTtlMs]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!inviteOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInviteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inviteOpen]);

  useEffect(() => {
    let screenshotTimeoutId: number | null = null;

    const activateFocusShield = () => {
      setPrivacyShieldReason('focus');
      setPrivacyShieldActive(true);
    };

    const clearShield = () => {
      if (!document.hidden) {
        setPrivacyShieldActive(false);
        setPrivacyShieldReason(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        activateFocusShield();
      } else {
        clearShield();
      }
    };

    const handleScreenshotShortcut = (event: KeyboardEvent) => {
      const isPrintScreen = event.key === 'PrintScreen';
      const isMacScreenshot =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        (event.key === '3' || event.key === '4' || event.key === '5');

      if (!isPrintScreen && !isMacScreenshot) {
        return;
      }

      setPrivacyShieldReason('screenshot');
      setPrivacyShieldActive(true);
      if (screenshotTimeoutId) {
        window.clearTimeout(screenshotTimeoutId);
      }
      screenshotTimeoutId = window.setTimeout(() => {
        if (!document.hidden) {
          setPrivacyShieldActive(false);
          setPrivacyShieldReason(null);
        }
      }, 1400);
    };

    window.addEventListener('blur', activateFocusShield);
    window.addEventListener('focus', clearShield);
    window.addEventListener('keydown', handleScreenshotShortcut);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (screenshotTimeoutId) {
        window.clearTimeout(screenshotTimeoutId);
      }
      window.removeEventListener('blur', activateFocusShield);
      window.removeEventListener('focus', clearShield);
      window.removeEventListener('keydown', handleScreenshotShortcut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const touchRoomActivity = async () => {
    await supabase.from('rooms').update({ last_activity_at: new Date().toISOString() }).eq('id', room.id);
  };

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
            : msg.message_type === 'system'
              ? msg.encrypted_content
              : await decryptMessage(msg.encrypted_content, msg.iv, room.key),
        })),
      );
      setMessages(pruneExpiredMessages(decrypted, roomTtlMs));
    }
  };

  const fetchUsernames = async (userIds: string[]) => {
    const uniqueMissingIds = [...new Set(userIds)].filter((id) => id && !profiles[id]);
    if (uniqueMissingIds.length === 0) {
      return;
    }

    const { data } = await supabase.from('profiles').select('id, username, profile_emoji').in('id', uniqueMissingIds);
    if (!data) {
      return;
    }

    setProfiles((prev) => {
      const next = { ...prev };
      for (const profile of data) {
        next[profile.id] = {
          username: profile.username,
          profile_emoji: normalizeProfileEmoji(profile.profile_emoji),
        };
      }
      return next;
    });
  };

  const getAuthorLabel = (messageUserId: string) => {
    if (messageUserId === user?.id) {
      return 'Voce';
    }

    return profiles[messageUserId]?.username ?? `Membro ${messageUserId.slice(0, 4)}`;
  };

  const getAuthorEmoji = (messageUserId: string) => {
    if (messageUserId === user?.id) {
      return profiles[messageUserId]?.profile_emoji ?? DEFAULT_PROFILE_EMOJI;
    }

    return profiles[messageUserId]?.profile_emoji ?? DEFAULT_PROFILE_EMOJI;
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || !user || isSending) {
      return;
    }

    setIsSending(true);
    const content = newMessage.trim();
    const { encrypted, iv } = await encryptMessage(content, room.key);
    const expiresAt = new Date(Date.now() + roomTtlMs).toISOString();
    setNewMessage('');

    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      room_id: room.id,
      user_id: user.id,
      encrypted_content: encrypted,
      iv,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      decrypted_content: content,
      message_type: 'user',
    };
    setMessages((prev) => pruneExpiredMessages([...prev, optimisticMsg], roomTtlMs));

    const { error } = await supabase.from('messages').insert([
      {
        id: optimisticMsg.id,
        room_id: room.id,
        user_id: user.id,
        encrypted_content: encrypted,
        iv,
        expires_at: expiresAt,
        message_type: 'user',
      },
    ]);

    if (error) {
      alert(error.message);
      setNewMessage(content);
    } else {
      await touchRoomActivity();
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
      alert('O arquivo e muito grande. O limite maximo e de 5MB.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    const mediaId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const mediaPath = `${room.id}/${mediaId}`;
    const expiresAt = new Date(Date.now() + roomTtlMs).toISOString();
    let uploadSucceeded = false;
    const mediaViewSeconds = mediaProtectionMode === '30s' ? 30 : null;

    try {
      const buffer = await file.arrayBuffer();
      const { encrypted, iv } = await encryptData(buffer, room.key);
      const encryptedBytes = base64ToUint8Array(encrypted);
      const encryptedPayload = new Uint8Array(encryptedBytes.byteLength);
      encryptedPayload.set(encryptedBytes);
      const encryptedBlob = new Blob([encryptedPayload.buffer], {
        type: 'application/octet-stream',
      });

      const optimisticMediaMsg: Message = {
        id: messageId,
        room_id: room.id,
        user_id: user.id,
        encrypted_content: '[View-Once Media]',
        iv,
        is_view_once: true,
        media_id: mediaId,
        media_type: file.type,
        media_view_mode: mediaProtectionMode,
        media_view_seconds: mediaViewSeconds,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        message_type: 'user',
      };
      setMessages((prev) => pruneExpiredMessages([...prev, optimisticMediaMsg], roomTtlMs));

      await uploadEncryptedMedia(mediaPath, encryptedBlob);
      uploadSucceeded = true;

      const { error: msgError } = await supabase.from('messages').insert([
        {
          id: messageId,
          room_id: room.id,
          user_id: user.id,
          encrypted_content: '[View-Once Media]',
          iv,
          expires_at: expiresAt,
          message_type: 'user',
          is_view_once: true,
          media_id: mediaId,
          media_type: file.type,
          media_view_mode: mediaProtectionMode,
          media_view_seconds: mediaViewSeconds,
        },
      ]);

      if (msgError) {
        throw msgError;
      }

      await touchRoomActivity();
    } catch (error: any) {
      if (uploadSucceeded) {
        await supabase.storage.from('ephemeral-media').remove([mediaPath]);
      }
      setMessages((prev) => prev.filter((message) => message.id !== messageId && message.media_id !== mediaId));
      alert(`Erro ao enviar midia: ${formatMediaUploadError(error)}`);
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
        iv: ivBuffer as BufferSource,
      },
      room.key,
      encryptedBuffer,
    );

    const mediaType = message.media_type || detectImageMimeType(decryptedBuffer) || 'application/octet-stream';
    return URL.createObjectURL(new Blob([decryptedBuffer], { type: mediaType }));
  };

  const handleMediaViewed = async (mediaId: string) => {
    await supabase.storage.from('ephemeral-media').remove([`${room.id}/${mediaId}`]);
    setMessages((prev) => prev.filter((message) => message.media_id !== mediaId));
    await supabase.from('messages').delete().eq('media_id', mediaId);
  };

  const shareInvite = async () => {
    try {
      const result = await shareRoomInvite({
        roomId: room.id,
        roomName: room.name,
        visibility: room.visibility,
        requirePasswordEveryTime: room.requirePasswordEveryTime,
      });

      if (result === 'copied') {
        alert(
          room.requirePasswordEveryTime
            ? 'Convite copiado. Envie a senha da sala separadamente.'
            : 'Convite copiado para a area de transferencia.',
        );
      }
    } catch (error: unknown) {
      if ((error as { name?: string } | null)?.name === 'AbortError') {
        return;
      }

      alert('Nao foi possivel compartilhar o convite.');
    }
  };

  const copyInvite = async () => {
    try {
      await copyRoomInvite({
        roomId: room.id,
        visibility: room.visibility,
        requirePasswordEveryTime: room.requirePasswordEveryTime,
        password: roomPassword || undefined,
      });
      alert(
        room.requirePasswordEveryTime
          ? roomPassword
            ? 'Link e senha copiados para a area de transferencia.'
            : 'Link copiado. Envie a senha da sala separadamente.'
          : 'Link copiado para a area de transferencia.',
      );
    } catch {
      alert('Nao foi possivel copiar o convite.');
    }
  };

  const copyPassword = async () => {
    if (!roomPassword) {
      alert('Nenhuma senha salva nesta sessao para esta sala.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomPassword);
      } else {
        window.prompt('Copie a senha da sala:', roomPassword);
      }
      alert('Senha da sala copiada.');
    } catch {
      alert('Nao foi possivel copiar a senha da sala.');
    }
  };

  return (
    <div className="page-shell chat-page" onContextMenu={(event) => event.preventDefault()}>
      <Topbar
        className="chat-topbar"
        title={<span>{room.name}</span>}
        subtitle={
          <span className="toolbar-row text-offline">
            <LockKeyhole size={14} />
            <span>{room.description?.trim() || 'Criptografia ativa e expiracao configurada por sala.'}</span>
          </span>
        }
        badges={
          <>
            <Badge variant={room.visibility}>{visibilityLabel}</Badge>
            <Badge variant={room.requirePasswordEveryTime ? 'warning' : 'info'}>
              {room.requirePasswordEveryTime ? 'Senha sempre' : 'Reentrada salva'}
            </Badge>
            {room.category ? <Badge variant="muted">{room.category}</Badge> : null}
          </>
        }
        leading={<IconButton icon={<ArrowLeft size={18} />} label="Voltar" onClick={onLeave} />}
        trailing={
          <div className="toolbar-row chat-topbar__actions">
            <TimerPill minutes={room.messageTtlMinutes} variant="strong" />
            {room.visibility !== 'personal' ? (
              <IconButton
                icon={<Link2 size={18} />}
                label="Convidar amigos"
                variant="ghost"
                onClick={() => setInviteOpen(true)}
              />
            ) : null}
          </div>
        }
      />

      <main className="page-container chat-main chat-layout">
        <section className="chat-thread">
          <div className="chat-content-panel">
            <div className="chat-scroll section-stack">
              <Card className="chat-system-note">
                <div className="toolbar-row">
                  <Badge variant={room.visibility}>{visibilityLabel}</Badge>
                  <TimerPill minutes={room.messageTtlMinutes} />
                </div>
                <p className="text-muted">
                  Mensagens desta sala expiram em {room.messageTtlMinutes} minutos. Midias view-once continuam com protecao especial.
                </p>
              </Card>

              {messages.length === 0 ? (
                <Card className="empty-state">
                  <Badge variant="info">Criptografia ativa</Badge>
                  <h3 className="topbar__title">Nenhuma mensagem ainda</h3>
                  <p className="text-muted">
                    O que for enviado aqui expira em {room.messageTtlMinutes} minutos e fica cifrado em transito e repouso.
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
                    if (msg.message_type === 'system') {
                      return (
                        <Card key={msg.id} className="chat-system-note chat-system-note--message">
                          <Badge variant="info">Sistema</Badge>
                          <p className="text-muted">{msg.decrypted_content ?? msg.encrypted_content}</p>
                        </Card>
                      );
                    }

                    const isMe = msg.user_id === user?.id;
                    const prevMsg = messages[idx - 1];
                    const isSameUser = prevMsg?.user_id === msg.user_id && prevMsg?.message_type !== 'system';

                    return (
                      <div key={msg.id} className={cn(isSameUser && 'section-stack section-stack--sm')}>
                        <MessageBubble
                          own={isMe}
                          author={getAuthorLabel(msg.user_id)}
                          avatarEmoji={getAuthorEmoji(msg.user_id)}
                          time={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          senderVariant={getSenderVariant(msg.user_id)}
                          showAvatar={!isSameUser}
                          content={
                            msg.is_view_once ? (
                              <ViewOnceBubble
                                mediaId={msg.media_id!}
                                onViewed={handleMediaViewed}
                                decryptMedia={decryptMedia}
                                mode={msg.media_view_mode ?? 'once'}
                                durationSeconds={msg.media_view_seconds}
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
          <StatsCard
            label="Retencao"
            value={`${room.messageTtlMinutes}m`}
            description="Mensagens de texto e metadados da sala seguem o TTL configurado nesta conversa."
          />
          <StatsCard label="Uploads" value="5MB" description="Midia view-once com limite atual de cinco megabytes." />
          <Card className="section-stack">
            <p className="eyebrow">Contexto da sala</p>
            <SettingsRow
              title="Protecao da chave"
              description="Derivacao local por sala via Web Crypto antes de ler ou enviar mensagens."
              icon={<ShieldCheck size={18} />}
            />
            <SettingsRow
              title="Visibilidade ativa"
              description={`Esta sala esta marcada como ${visibilityLabel.toLowerCase()}.`}
              icon={<LockKeyhole size={18} />}
            />
            <SettingsRow
              title="Privacidade efemera"
              description="Fotos view-once sao removidas do storage assim que visualizadas."
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
          <div className="media-mode-switch" role="tablist" aria-label="Modo de protecao da midia">
            <button
              type="button"
              className={cn('media-mode-switch__option', mediaProtectionMode === 'once' && 'media-mode-switch__option--active')}
              onClick={() => setMediaProtectionMode('once')}
              aria-pressed={mediaProtectionMode === 'once'}
            >
              View-once
            </button>
            <button
              type="button"
              className={cn('media-mode-switch__option', mediaProtectionMode === '30s' && 'media-mode-switch__option--active')}
              onClick={() => setMediaProtectionMode('30s')}
              aria-pressed={mediaProtectionMode === '30s'}
            >
              30s
            </button>
          </div>
          <Composer
            value={newMessage}
            onChange={setNewMessage}
            onSubmit={sendMessage}
            onFileClick={() => fileInputRef.current?.click()}
            sending={isSending}
            uploading={isUploading}
            timerLabel={`${room.messageTtlMinutes}m`}
            hint={`Mensagens expiram em ${room.messageTtlMinutes} min nesta sala.`}
          />
        </div>
      </div>

      {privacyShieldActive ? (
        <div className="privacy-shield" aria-live="polite">
          <div className="privacy-shield__card">
            <Badge variant="warning">Protecao ativa</Badge>
            <h2 className="topbar__title">Conteudo oculto</h2>
            <p className="text-muted">
              {privacyShieldReason === 'screenshot'
                ? 'Atalho de captura detectado. A web nao consegue impedir prints do sistema, mas a interface foi ocultada para reduzir exposicao visual.'
                : 'A conversa foi ocultada porque a janela perdeu foco ou ficou em segundo plano.'}
            </p>
          </div>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
          <button type="button" className="invite-modal__backdrop" aria-label="Fechar convite" onClick={() => setInviteOpen(false)} />
          <Card className="invite-modal__card">
            <div className="invite-modal__header">
              <div className="section-stack section-stack--sm">
                <p className="eyebrow">Convidar amigos</p>
                <h2 id="invite-modal-title" className="topbar__title">Compartilhe esta sala</h2>
              </div>
              <IconButton
                icon={<X size={18} />}
                label="Fechar convite"
                variant="ghost"
                onClick={() => setInviteOpen(false)}
              />
            </div>

            <div className="section-stack section-stack--sm">
              <p className="text-muted">
                {room.requirePasswordEveryTime
                  ? 'Compartilhe o link e envie a senha da sala separadamente.'
                  : 'Compartilhe o link abaixo para convidar amigos para esta sala.'}
              </p>
              <div className="invite-modal__link-box">
                <span className="invite-modal__link">{inviteUrl}</span>
              </div>
              {room.requirePasswordEveryTime ? (
                <div className="invite-modal__password">
                  <span className="ui-field__label">Senha da sala</span>
                  <div className="invite-modal__link-box invite-modal__password-box">
                    <span className="invite-modal__link">
                      {roomPassword || 'Nenhuma senha salva nesta sessao. Entre novamente com a senha da sala para copiar.'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="invite-modal__actions">
              <Button variant="secondary" leadingIcon={<Copy size={16} />} onClick={() => void copyInvite()}>
                Copiar link
              </Button>
              {room.requirePasswordEveryTime ? (
                <Button variant="secondary" leadingIcon={<Copy size={16} />} onClick={() => void copyPassword()}>
                  Copiar senha
                </Button>
              ) : null}
              <Button leadingIcon={<Share2 size={16} />} onClick={() => void shareInvite()}>
                Compartilhar
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

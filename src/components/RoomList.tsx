import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Home,
  Link2,
  LockKeyhole,
  PlusSquare,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
} from 'lucide-react';
import { deriveKey, deriveRoomPasswordVerifier, getSalt } from '../lib/crypto';
import { DEFAULT_PROFILE_EMOJI, normalizeProfileEmoji } from '../lib/profileEmoji';
import { shareRoomInvite } from '../lib/share';
import { supabase } from '../lib/supabase';
import type { ActiveRoom, RoomAccessEntry, RoomRole, RoomSummary, RoomVisibility } from '../types/rooms';
import {
  Avatar,
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  Input,
  PasswordField,
  SearchBarPill,
} from './ui';

interface RoomListProps {
  onJoinRoom: (room: ActiveRoom) => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
  invitedRoomId?: string | null;
  onInviteHandled?: () => void;
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Minhas' },
  { id: 'community', label: 'Comunidade' },
  { id: 'favorites', label: 'Favoritas' },
  { id: '+18', label: '+18' },
] as const;

const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  public: 'Publica',
  unlisted: 'Nao listada',
  personal: 'Pessoal',
};

interface InviteSnapshot {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  visibility: RoomVisibility;
  message_ttl_minutes: 5 | 10 | 15 | 20;
  require_password_every_time: boolean;
  password_verifier: string | null;
  age_group: 'Livre' | '+18';
  created_by: string | null;
  last_activity_at: string | null;
  created_at: string;
}

interface JoinRoomResult {
  ok: boolean;
  reason: string;
}

interface RpcErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

function isRpcMissingError(error: unknown) {
  const candidate = (error ?? {}) as RpcErrorLike;
  return (
    candidate.status === 404 ||
    candidate.code === 'PGRST202' ||
    candidate.message?.toLowerCase().includes('could not find the function') === true
  );
}

function parseInviteInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.searchParams.get('room');
  } catch {
    return trimmed.match(/[0-9a-fA-F-]{36}/)?.[0] ?? trimmed;
  }
}

export default function RoomList({
  onJoinRoom,
  onOpenProfile,
  onOpenCreate,
  invitedRoomId = null,
  onInviteHandled,
}: RoomListProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    age_group: 'Livre' | '+18';
    full_name: string | null;
    username: string;
    profile_emoji: string;
  } | null>(null);
  const [userAccess, setUserAccess] = useState<Record<string, RoomAccessEntry>>({});
  const [accessReady, setAccessReady] = useState(false);
  const [roomMemberCounts, setRoomMemberCounts] = useState<Record<string, number>>({});
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTER_OPTIONS)[number]['id']>('all');
  const [rpcInviteAvailable, setRpcInviteAvailable] = useState(true);
  const [rpcJoinAvailable, setRpcJoinAvailable] = useState(true);

  useEffect(() => {
    void fetchProfile();
    void fetchRooms();
    void fetchUserAccess();
    void fetchRoomMemberCounts();
  }, []);

  useEffect(() => {
    if (!invitedRoomId || !accessReady) {
      return;
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(invitedRoomId)) {
      onInviteHandled?.();
      return;
    }

    const handleInvite = async () => {
      const room = rooms.find((item) => item.id === invitedRoomId) ?? (await fetchRoomById(invitedRoomId));
      if (room) {
        await tryJoinDirectly(room);
      }
      onInviteHandled?.();
    };

    void handleInvite();
  }, [accessReady, invitedRoomId, onInviteHandled, rooms]);

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('id, age_group, full_name, username, profile_emoji')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserProfile({
          ...data,
          profile_emoji: normalizeProfileEmoji(data.profile_emoji),
        });
      }
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setRooms(data);
    }
  };

  const fetchUserAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('room_access')
        .select('room_id, role, is_favorite, last_seen_at, created_at')
        .eq('user_id', user.id);

      if (data) {
        setUserAccess(
          data.reduce<Record<string, RoomAccessEntry>>((accumulator, access) => {
            accumulator[access.room_id] = access;
            return accumulator;
          }, {}),
        );
      }
    }

    setAccessReady(true);
  };

  const fetchRoomMemberCounts = async () => {
    const { data } = await supabase.from('room_access').select('room_id');
    if (!data) {
      return;
    }

    const counts = data.reduce<Record<string, number>>((accumulator, access) => {
      accumulator[access.room_id] = (accumulator[access.room_id] ?? 0) + 1;
      return accumulator;
    }, {});

    setRoomMemberCounts(counts);
  };

  const toRoomSummary = (snapshot: InviteSnapshot): RoomSummary => ({
    id: snapshot.id,
    name: snapshot.name,
    description: snapshot.description,
    age_group: snapshot.age_group,
    category: snapshot.category || 'Geral',
    visibility: snapshot.visibility,
    message_ttl_minutes: snapshot.message_ttl_minutes,
    require_password_every_time: snapshot.require_password_every_time,
    password_verifier: snapshot.password_verifier,
    created_by: snapshot.created_by,
    is_archived: false,
    last_activity_at: snapshot.last_activity_at ?? snapshot.created_at,
    created_at: snapshot.created_at,
  });

  const fetchRoomById = async (roomId: string) => {
    if (!rpcInviteAvailable) {
      const { data: fallbackData, error: fallbackError } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (fallbackError || !fallbackData) {
        return null;
      }
      setRooms((current) => (current.some((item) => item.id === fallbackData.id) ? current : [fallbackData, ...current]));
      return fallbackData as RoomSummary;
    }

    const { data, error } = await supabase.rpc('get_room_invite_snapshot', { p_room_id: roomId });
    if (!error && Array.isArray(data) && data.length > 0) {
      const room = toRoomSummary(data[0] as InviteSnapshot);
      setRooms((current) => (current.some((item) => item.id === room.id) ? current : [room, ...current]));
      return room;
    }

    if (!isRpcMissingError(error)) {
      return null;
    }

    setRpcInviteAvailable(false);

    const { data: fallbackData, error: fallbackError } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (fallbackError || !fallbackData) {
      return null;
    }

    setRooms((current) => (current.some((item) => item.id === fallbackData.id) ? current : [fallbackData, ...current]));
    return fallbackData as RoomSummary;
  };

  const registerAccess = async (roomId: string, role?: RoomRole) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      room_id: roomId,
      last_seen_at: new Date().toISOString(),
    };

    if (role) {
      payload.role = role;
    }

    const { data, error } = await supabase
      .from('room_access')
      .upsert(payload, { onConflict: 'user_id, room_id' })
      .select('room_id, role, is_favorite, last_seen_at, created_at')
      .single();

    if (error || !data) {
      return false;
    }

    setUserAccess((current) => ({ ...current, [roomId]: data }));
    return true;
  };

  const validateRoomPassword = async (room: RoomSummary, password: string) => {
    if (!room.password_verifier) {
      return 'legacy' as const;
    }

    const verifier = await deriveRoomPasswordVerifier(password, room.id);
    return verifier === room.password_verifier ? ('valid' as const) : ('invalid' as const);
  };

  const joinRoomLegacy = async (room: RoomSummary, password: string) => {
    const passwordStatus = await validateRoomPassword(room, password);
    if (passwordStatus === 'legacy') {
      return { ok: false, reason: 'room_without_verifier' } as JoinRoomResult;
    }

    if (passwordStatus === 'invalid') {
      return { ok: false, reason: 'invalid_password' } as JoinRoomResult;
    }

    const accessSaved = await registerAccess(room.id, room.created_by === userProfile?.id ? 'owner' : undefined);
    if (!accessSaved) {
      return { ok: false, reason: 'legacy_access_failed' } as JoinRoomResult;
    }

    return { ok: true, reason: 'ok_legacy' } as JoinRoomResult;
  };

  const joinRoomSecure = async (room: RoomSummary, password: string) => {
    if (!rpcJoinAvailable) {
      return joinRoomLegacy(room, password);
    }

    const { data, error } = await supabase.rpc('join_room_with_password', {
      p_room_id: room.id,
      p_password: password,
    });

    if (error && isRpcMissingError(error)) {
      setRpcJoinAvailable(false);
      return joinRoomLegacy(room, password);
    }

    if (error) {
      return { ok: false, reason: 'rpc_error' } as JoinRoomResult;
    }

    const first = Array.isArray(data) && data.length > 0 ? (data[0] as JoinRoomResult) : null;
    if (!first) {
      return { ok: false, reason: 'invalid_response' } as JoinRoomResult;
    }

    if (first.ok) {
      await fetchUserAccess();
    }

    return first;
  };

  const openRoomWithKey = async (room: RoomSummary, password: string) => {
    const joinResult = await joinRoomSecure(room, password);
    if (!joinResult.ok) {
      const reasonMessageMap: Record<string, string> = {
        unauthenticated: 'Sessao expirada. Entre novamente para continuar.',
        room_not_found: 'Sala nao encontrada.',
        age_group_mismatch: 'Seu perfil nao tem permissao para entrar nesta sala.',
        personal_room_forbidden: 'Esta sala pessoal nao esta disponivel para sua conta.',
        room_without_verifier: 'Esta sala nao possui verificador de senha configurado.',
        invalid_password: 'Senha da sala incorreta.',
        legacy_access_failed: 'Nao foi possivel registrar seu acesso a esta sala.',
      };

      alert(reasonMessageMap[joinResult.reason] ?? 'Nao foi possivel entrar na sala agora.');
      return false;
    }

    const salt = getSalt(room.id);
    const key = await deriveKey(password, salt);
    sessionStorage.setItem(`room_key_${room.id}`, password);

    onJoinRoom({
      id: room.id,
      name: room.name,
      key,
      requirePasswordEveryTime: room.require_password_every_time,
      visibility: room.visibility,
      messageTtlMinutes: room.message_ttl_minutes,
      createdBy: room.created_by,
      description: room.description,
      category: room.category,
    });

    return true;
  };

  const tryJoinDirectly = async (room: RoomSummary) => {
    if (room.visibility === 'personal' && room.created_by !== userProfile?.id) {
      alert('Esta sala pessoal nao esta disponivel para a sua conta.');
      return;
    }

    const savedKey = sessionStorage.getItem(`room_key_${room.id}`);
    const hasAccess = Boolean(userAccess[room.id]) || room.created_by === userProfile?.id;

    if (hasAccess && !room.require_password_every_time && savedKey) {
      const opened = await openRoomWithKey(room, savedKey);
      if (!opened) {
        sessionStorage.removeItem(`room_key_${room.id}`);
        setInputKey('');
        setJoiningRoomId(room.id);
      }
      return;
    }

    setInputKey('');
    setJoiningRoomId(room.id);
  };

  const joinWithKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!joiningRoomId) {
      return;
    }

    const room = rooms.find((item) => item.id === joiningRoomId);
    if (!room) {
      return;
    }

    const opened = await openRoomWithKey(room, inputKey);
    if (!opened) {
      return;
    }

    setJoiningRoomId(null);
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const roomId = parseInviteInput(inviteInput);
    if (!roomId) {
      alert('Cole um link de convite ou codigo valido.');
      return;
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(roomId)) {
      alert('Codigo de sala invalido. Use um convite com ID UUID.');
      return;
    }

    const room = rooms.find((item) => item.id === roomId) ?? (await fetchRoomById(roomId));
    if (!room) {
      alert('Sala nao encontrada ou indisponivel para a sua conta.');
      return;
    }

    await tryJoinDirectly(room);
  };

  const toggleFavorite = async (room: RoomSummary) => {
    const current = userAccess[room.id];
    const nextFavorite = !current?.is_favorite;

    if (!current && room.created_by !== userProfile?.id) {
      alert('Entre na sala antes de favoritar.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const payload = {
      user_id: user.id,
      room_id: room.id,
      role: current?.role ?? (room.created_by === userProfile?.id ? 'owner' : 'member'),
      is_favorite: nextFavorite,
      last_seen_at: current?.last_seen_at ?? new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('room_access')
      .upsert(payload, { onConflict: 'user_id, room_id' })
      .select('room_id, role, is_favorite, last_seen_at, created_at')
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setUserAccess((currentAccess) => ({ ...currentAccess, [room.id]: data }));
    }
  };

  const handleShareRoom = async (room: RoomSummary) => {
    if (room.visibility === 'personal') {
      return;
    }

    try {
      const result = await shareRoomInvite({
        roomId: room.id,
        roomName: room.name,
        visibility: room.visibility,
        requirePasswordEveryTime: room.require_password_every_time,
      });

      if (result === 'copied') {
        alert(
          room.require_password_every_time
            ? 'Convite copiado. Envie a senha da sala separadamente.'
            : 'Convite copiado para a area de transferencia.',
        );
      }
    } catch (error: unknown) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') {
        alert('Nao foi possivel compartilhar o convite.');
      }
    }
  };

  const visibleRooms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rooms.filter((room) => {
      if (room.is_archived) {
        return false;
      }

      const matchesSearch =
        normalizedSearch.length === 0 ||
        room.name.toLowerCase().includes(normalizedSearch) ||
        room.category.toLowerCase().includes(normalizedSearch) ||
        room.description?.toLowerCase().includes(normalizedSearch) ||
        room.id.toLowerCase().includes(normalizedSearch);

      const isMyRoom = room.created_by === userProfile?.id || Boolean(userAccess[room.id]);
      const isFavorite = userAccess[room.id]?.is_favorite ?? false;

      const matchesFilter =
        selectedFilter === 'all' ||
        (selectedFilter === 'mine' && isMyRoom) ||
        (selectedFilter === 'community' && room.visibility === 'public') ||
        (selectedFilter === 'favorites' && isFavorite) ||
        (selectedFilter === '+18' && room.age_group === '+18');

      return matchesSearch && matchesFilter;
    });
  }, [rooms, searchTerm, selectedFilter, userAccess, userProfile?.id]);

  const conversationRooms = useMemo(
    () =>
      [...visibleRooms].sort((left, right) => {
        const leftDate = userAccess[left.id]?.last_seen_at ?? left.last_activity_at ?? left.created_at;
        const rightDate = userAccess[right.id]?.last_seen_at ?? right.last_activity_at ?? right.created_at;
        return Date.parse(rightDate) - Date.parse(leftDate);
      }),
    [userAccess, visibleRooms],
  );

  const myRoomsCount = useMemo(
    () => rooms.filter((room) => room.created_by === userProfile?.id || Boolean(userAccess[room.id])).length,
    [rooms, userAccess, userProfile?.id],
  );

  const favoriteCount = useMemo(
    () => Object.values(userAccess).filter((room) => room.is_favorite).length,
    [userAccess],
  );

  const communityCount = useMemo(
    () => rooms.filter((room) => !room.is_archived && room.visibility === 'public').length,
    [rooms],
  );

  const greetingName = userProfile?.full_name?.split(' ')[0] || userProfile?.username || 'Usuario';
  const securityZoneLabel = userProfile?.age_group === '+18' ? '18+ Zone' : 'Livre';

  const getRoomTimestampLabel = (room: RoomSummary) => {
    const sourceDate = userAccess[room.id]?.last_seen_at ?? room.last_activity_at ?? room.created_at;
    const parsed = new Date(sourceDate);
    const today = new Date();

    const sameDay =
      parsed.getDate() === today.getDate() &&
      parsed.getMonth() === today.getMonth() &&
      parsed.getFullYear() === today.getFullYear();

    if (sameDay) {
      return parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const hasDirectAccess = (room: RoomSummary) =>
    (Boolean(userAccess[room.id]) || room.created_by === userProfile?.id) &&
    !room.require_password_every_time &&
    Boolean(room.password_verifier) &&
    Boolean(sessionStorage.getItem(`room_key_${room.id}`));

  return (
    <div className="page-shell home-page vault-home-shell">
      <header className="vault-home-topbar">
        <div className="vault-home-topbar__inner">
          <div className="vault-brand">
            <Avatar fallback={greetingName} size="sm" emoji={userProfile?.profile_emoji || DEFAULT_PROFILE_EMOJI} />
            <div>
              <h1 className="vault-brand__title">The Vault</h1>
              <p className="home-section-subtitle">{greetingName}, suas conversas seguras estao aqui.</p>
            </div>
          </div>

          <div className="toolbar-row">
            <span className="vault-secure-pill">
              <ShieldCheck size={12} />
              Secure
            </span>
            <button type="button" className="home-avatar-button" onClick={onOpenProfile} aria-label="Abrir perfil">
              <Avatar fallback={greetingName} size="sm" emoji={userProfile?.profile_emoji || DEFAULT_PROFILE_EMOJI} />
            </button>
          </div>
        </div>
      </header>

      <main className="page-container page-stack home-main vault-home-main">
        <SearchBarPill
          label="Buscar salas"
          placeholder="Buscar salas, codigos ou categorias"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          trailing={
            <button type="button" className="home-search-filter" aria-label="Filtros">
              <SlidersHorizontal size={18} />
            </button>
          }
        />

        <section className="vault-status-grid" aria-label="Visao de seguranca">
          <Card className="vault-status-card">
            <div className="vault-status-card__head">
              <LockKeyhole size={18} />
              <p className="vault-status-card__label">Keys ativas</p>
            </div>
            <p className="vault-status-card__value">{myRoomsCount}</p>
            <p className="vault-status-card__description">salas com acesso registrado neste dispositivo</p>
          </Card>

          <Card className="vault-status-card">
            <div className="vault-status-card__head">
              <Star size={18} />
              <p className="vault-status-card__label">Zona segura</p>
            </div>
            <p className="vault-status-card__value">{securityZoneLabel}</p>
            <p className="vault-status-card__description">{favoriteCount} favoritas e {communityCount} salas publicas</p>
          </Card>
        </section>

        <section className="section-stack section-stack--sm">
          <div className="home-section-header">
            <div className="home-section-copy">
              <p className="home-section-title">Conversas</p>
              <p className="home-section-subtitle">Estrutura inspirada no roadmap: lista densa, contexto rapido e entrada direta.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenCreate} leadingIcon={<PlusSquare size={16} />}>
              Criar sala
            </Button>
          </div>

          <div className="vault-filter-row">
            {FILTER_OPTIONS.map((filter) => (
              <Chip
                key={filter.id}
                selected={selectedFilter === filter.id}
                className="home-filter-chip"
                onClick={() => setSelectedFilter(filter.id)}
              >
                {filter.label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="vault-conversation-block">
          <div className="vault-conversation-header">
            <p className="vault-conversation-title">Mensagens recentes</p>
            <p className="vault-conversation-subtitle">{conversationRooms.length} conversa(s) visiveis</p>
          </div>

          {conversationRooms.length === 0 ? (
            <Card className="empty-state">
              <Badge variant="warning">Vazio</Badge>
              <h3 className="topbar__title">Nada por aqui</h3>
              <p className="text-muted">Nenhuma sala combinou com os filtros e busca atuais.</p>
            </Card>
          ) : (
            <div className="vault-conversation-list">
              {conversationRooms.map((room) => {
                const directAccess = hasDirectAccess(room);
                const selected = joiningRoomId === room.id;
                const presenceCount = roomMemberCounts[room.id] ?? 0;

                return (
                  <article
                    key={room.id}
                    className={`vault-room-item ${selected ? 'vault-room-item--active' : ''}`}
                    aria-label={`Sala ${room.name}`}
                  >
                    <div className="vault-room-item__row">
                      <button type="button" className="vault-room-item__button" onClick={() => void tryJoinDirectly(room)}>
                        <span className="vault-room-item__avatar" aria-hidden="true">
                          <img src="/chatcripto-logo.png" alt="" />
                          {presenceCount > 0 ? <span className="vault-room-item__presence" /> : null}
                        </span>

                        <span className="vault-room-item__content">
                          <span className="vault-room-item__head">
                            <span className="vault-room-item__name">{room.name}</span>
                            <span className="vault-room-item__time">{getRoomTimestampLabel(room)}</span>
                          </span>
                          <span className="vault-room-item__description">
                            {room.description?.trim() || `Sala ${VISIBILITY_LABELS[room.visibility].toLowerCase()} na categoria ${room.category.toLowerCase()}.`}
                          </span>
                          <span className="vault-room-item__meta">
                            <span className="vault-room-item__badge">{room.age_group}</span>
                            <span className="vault-room-item__badge">{VISIBILITY_LABELS[room.visibility]}</span>
                            <span className="vault-room-item__badge vault-room-item__badge--ttl">{room.message_ttl_minutes}m</span>
                            {presenceCount > 0 ? <span className="vault-room-item__badge">{presenceCount} online</span> : null}
                          </span>
                        </span>

                        <span className="vault-room-item__icon" aria-hidden="true">
                          {directAccess ? <ShieldCheck size={14} /> : <ArrowRight size={14} />}
                        </span>
                      </button>

                      <div className="vault-room-item__actions">
                        <button
                          type="button"
                          className={`vault-room-item__icon ${userAccess[room.id]?.is_favorite ? 'vault-room-item__icon--active' : ''}`}
                          onClick={() => void toggleFavorite(room)}
                          aria-label={userAccess[room.id]?.is_favorite ? 'Remover dos favoritos' : 'Favoritar sala'}
                        >
                          <Star size={14} />
                        </button>
                        {room.visibility !== 'personal' ? (
                          <button
                            type="button"
                            className="vault-room-item__icon"
                            onClick={() => void handleShareRoom(room)}
                            aria-label="Compartilhar sala"
                          >
                            <Link2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {selected ? (
                      <form className="vault-room-item__join section-stack section-stack--sm" onSubmit={joinWithKey}>
                        <PasswordField
                          label="Chave da sala"
                          autoFocus
                          placeholder="Digite a senha de acesso"
                          value={inputKey}
                          onChange={(event) => setInputKey(event.target.value)}
                          required
                        />
                        <div className="vault-room-item__join-actions">
                          <Button variant="ghost" type="button" onClick={() => setJoiningRoomId(null)}>
                            Cancelar
                          </Button>
                          <Button type="submit">Entrar</Button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <Card className="section-stack vault-invite-entry">
          <div className="section-stack section-stack--sm">
            <p className="eyebrow">Entrar por convite</p>
            <h2 className="topbar__title">Cole um link ou codigo</h2>
            <p className="text-muted">Funciona para salas nao listadas e convites diretos compartilhados fora da comunidade.</p>
          </div>
          <form className="invite-entry__form" onSubmit={handleInviteSubmit}>
            <Input
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
              placeholder="https://... ?room= ou codigo da sala"
              aria-label="Link ou codigo da sala"
            />
            <Button type="submit">Abrir convite</Button>
          </form>
        </Card>
      </main>

      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: Home, active: true, onClick: () => undefined },
          { id: 'create', label: 'Criar', icon: PlusSquare, onClick: onOpenCreate },
          { id: 'profile', label: 'Perfil', icon: UserRound, onClick: onOpenProfile },
        ]}
      />
    </div>
  );
}

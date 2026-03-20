import { useEffect, useMemo, useState } from 'react';
import { Home, PlusSquare, SlidersHorizontal, UserRound } from 'lucide-react';
import { deriveKey, deriveRoomPasswordVerifier, getSalt } from '../lib/crypto';
import { DEFAULT_PROFILE_EMOJI, normalizeProfileEmoji } from '../lib/profileEmoji';
import { shareRoomInvite } from '../lib/share';
import { supabase } from '../lib/supabase';
import type { ActiveRoom, RoomAccessEntry, RoomRole, RoomSummary } from '../types/rooms';
import {
  Avatar,
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  Input,
  PasswordField,
  RoomCard,
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

  const fetchRoomById = async (roomId: string) => {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (error || !data) {
      return null;
    }

    setRooms((current) => (current.some((room) => room.id === data.id) ? current : [data, ...current]));
    return data as RoomSummary;
  };

  const registerAccess = async (roomId: string, role?: RoomRole) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      room_id: roomId,
      last_seen_at: new Date().toISOString(),
    };

    if (role) {
      payload.role = role;
    }

    const { data } = await supabase
      .from('room_access')
      .upsert(payload, { onConflict: 'user_id, room_id' })
      .select('room_id, role, is_favorite, last_seen_at, created_at')
      .single();

    if (data) {
      setUserAccess((current) => ({ ...current, [roomId]: data }));
    }
  };

  const validateRoomPassword = async (room: RoomSummary, password: string) => {
    if (!room.password_verifier) {
      return 'legacy' as const;
    }

    const verifier = await deriveRoomPasswordVerifier(password, room.id);
    return verifier === room.password_verifier ? ('valid' as const) : ('invalid' as const);
  };

  const openRoomWithKey = async (room: RoomSummary, password: string) => {
    const salt = getSalt(room.id);
    const key = await deriveKey(password, salt);
    sessionStorage.setItem(`room_key_${room.id}`, password);
    await registerAccess(room.id, room.created_by === userProfile?.id ? 'owner' : undefined);

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
  };

  const tryJoinDirectly = async (room: RoomSummary) => {
    if (room.visibility === 'personal' && room.created_by !== userProfile?.id) {
      alert('Esta sala pessoal nao esta disponivel para a sua conta.');
      return;
    }

    const savedKey = sessionStorage.getItem(`room_key_${room.id}`);
    const hasAccess = Boolean(userAccess[room.id]) || room.created_by === userProfile?.id;

    if (hasAccess && !room.require_password_every_time && savedKey) {
      const savedKeyStatus = await validateRoomPassword(room, savedKey);
      if (savedKeyStatus !== 'valid') {
        sessionStorage.removeItem(`room_key_${room.id}`);
        setInputKey('');
        setJoiningRoomId(room.id);
        if (savedKeyStatus === 'legacy') {
          alert('Esta sala foi criada em uma versao antiga. Recrie a sala para voltar a validar a senha corretamente.');
        }
        return;
      }

      await openRoomWithKey(room, savedKey);
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

    const passwordStatus = await validateRoomPassword(room, inputKey);
    if (passwordStatus !== 'valid') {
      alert(
        passwordStatus === 'legacy'
          ? 'Esta sala foi criada em uma versao antiga. Recrie a sala para validar a senha com seguranca.'
          : 'Senha da sala incorreta.',
      );
      return;
    }

    await openRoomWithKey(room, inputKey);
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const roomId = parseInviteInput(inviteInput);
    if (!roomId) {
      alert('Cole um link de convite ou codigo valido.');
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

  const myRooms = useMemo(
    () => visibleRooms.filter((room) => room.created_by === userProfile?.id || Boolean(userAccess[room.id])),
    [userAccess, userProfile?.id, visibleRooms],
  );

  const favoriteRooms = useMemo(
    () => myRooms.filter((room) => userAccess[room.id]?.is_favorite),
    [myRooms, userAccess],
  );

  const recentRooms = useMemo(
    () =>
      [...myRooms].sort((left, right) => {
        const leftDate = userAccess[left.id]?.last_seen_at ?? left.last_activity_at ?? left.created_at;
        const rightDate = userAccess[right.id]?.last_seen_at ?? right.last_activity_at ?? right.created_at;
        return Date.parse(rightDate) - Date.parse(leftDate);
      }),
    [myRooms, userAccess],
  );

  const ownedRooms = useMemo(
    () => myRooms.filter((room) => room.created_by === userProfile?.id),
    [myRooms, userProfile?.id],
  );

  const communityRooms = useMemo(
    () =>
      [...visibleRooms]
        .filter((room) => room.visibility === 'public')
        .sort((left, right) => (roomMemberCounts[right.id] ?? 0) - (roomMemberCounts[left.id] ?? 0)),
    [roomMemberCounts, visibleRooms],
  );

  const newestCommunityRooms = useMemo(
    () =>
      [...communityRooms].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
    [communityRooms],
  );

  const greetingName = userProfile?.full_name?.split(' ')[0] || userProfile?.username || 'Usuario';

  const renderRoomCollection = (title: string, subtitle: string, collection: RoomSummary[], emptyText: string) => (
    <section className="page-stack home-collection">
      <div className="home-collection__header">
        <div className="home-section-copy">
          <p className="eyebrow">{title}</p>
          <p className="home-section-subtitle">{subtitle}</p>
        </div>
      </div>

      {collection.length === 0 ? (
        <Card className="empty-state">
          <Badge variant="warning">Vazio</Badge>
          <h3 className="topbar__title">Nada por aqui</h3>
          <p className="text-muted">{emptyText}</p>
        </Card>
      ) : (
        <div className="room-grid home-room-grid">
          {collection.map((room) => {
            const directAccess =
              (Boolean(userAccess[room.id]) || room.created_by === userProfile?.id) &&
              !room.require_password_every_time &&
              Boolean(room.password_verifier) &&
              Boolean(sessionStorage.getItem(`room_key_${room.id}`));

            const presenceCount = roomMemberCounts[room.id] ?? 0;
            const presenceLabel = presenceCount === 1 ? 'pessoa com acesso' : 'pessoas com acesso';

            return (
              <RoomCard
                key={`${title}-${room.id}`}
                name={room.name}
                roomId={room.id}
                category={room.category}
                ageGroup={room.age_group}
                visibility={room.visibility}
                messageTtlMinutes={room.message_ttl_minutes}
                description={room.description}
                presenceCount={presenceCount}
                presenceLabel={presenceLabel}
                selected={joiningRoomId === room.id}
                directAccess={directAccess}
                locked={!directAccess}
                isFavorite={userAccess[room.id]?.is_favorite ?? false}
                isOwner={(userAccess[room.id]?.role ?? (room.created_by === userProfile?.id ? 'owner' : 'member')) === 'owner'}
                onShare={
                  room.visibility === 'personal'
                    ? undefined
                    : () => {
                        void shareRoomInvite({
                          roomId: room.id,
                          roomName: room.name,
                          visibility: room.visibility,
                          requirePasswordEveryTime: room.require_password_every_time,
                        })
                          .then((result) => {
                            if (result === 'copied') {
                              alert(
                                room.require_password_every_time
                                  ? 'Convite copiado. Envie a senha da sala separadamente.'
                                  : 'Convite copiado para a area de transferencia.',
                              );
                            }
                          })
                          .catch((error: { name?: string }) => {
                            if (error?.name !== 'AbortError') {
                              alert('Nao foi possivel compartilhar o convite.');
                            }
                          });
                      }
                }
                onToggleFavorite={() => void toggleFavorite(room)}
                onRequestJoin={() => void tryJoinDirectly(room)}
                joinForm={
                  joiningRoomId === room.id ? (
                    <form className="section-stack section-stack--sm" onSubmit={joinWithKey}>
                      <PasswordField
                        label="Chave da sala"
                        autoFocus
                        placeholder="Digite a senha de acesso"
                        value={inputKey}
                        onChange={(event) => setInputKey(event.target.value)}
                        required
                      />
                      <div className="toolbar-row">
                        <Button variant="ghost" type="button" onClick={() => setJoiningRoomId(null)}>
                          Cancelar
                        </Button>
                        <Button type="submit">Entrar</Button>
                      </div>
                    </form>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="page-shell home-page">
      <main className="page-container page-stack home-main">
        <section className="home-hero">
          <div className="home-greeting">
            <div className="section-stack section-stack--sm">
              <h1 className="home-greeting__title">Oi, {greetingName}</h1>
              <p className="home-greeting__subtitle">Suas salas privadas e a comunidade no mesmo painel.</p>
            </div>

            <div className="home-greeting__actions">
              <button type="button" className="home-avatar-button" onClick={onOpenProfile} aria-label="Abrir perfil">
                <Avatar
                  fallback={greetingName}
                  size="md"
                  emoji={userProfile?.profile_emoji || DEFAULT_PROFILE_EMOJI}
                />
              </button>
            </div>
          </div>

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
        </section>

        <section className="page-stack section-stack--sm">
          <div className="home-section-header">
            <div className="home-section-copy">
              <p className="home-section-title">Explorar</p>
              <p className="home-section-subtitle">Separe suas salas, a comunidade publica e os acessos recorrentes.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenCreate}>
              Criar sala
            </Button>
          </div>

          <div className="home-filter-row">
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

        {renderRoomCollection(
          'Minhas salas',
          'Recentes',
          recentRooms.slice(0, 6),
          'As salas em que voce entra vao aparecer aqui com base no ultimo acesso.',
        )}

        {renderRoomCollection(
          'Minhas salas',
          'Favoritas',
          favoriteRooms,
          'Marque como favorita para fixar as salas que mais importam.',
        )}

        {renderRoomCollection(
          'Minhas salas',
          'Criadas por mim',
          ownedRooms,
          'As salas criadas por voce vao aparecer aqui.',
        )}

        {renderRoomCollection(
          'Comunidade',
          'Em alta',
          communityRooms.slice(0, 6),
          'Nenhuma sala publica combinou com o filtro atual.',
        )}

        {renderRoomCollection(
          'Comunidade',
          'Novas',
          newestCommunityRooms.slice(0, 6),
          'Ainda nao ha salas novas disponiveis para o seu perfil.',
        )}

        <Card className="section-stack invite-entry">
          <div className="section-stack section-stack--sm">
            <p className="eyebrow">Entrar por convite</p>
            <h2 className="topbar__title">Cole um link ou codigo</h2>
            <p className="text-muted">
              Funciona para salas nao listadas e convites diretos compartilhados fora da comunidade.
            </p>
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

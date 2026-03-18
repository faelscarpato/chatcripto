import { useEffect, useMemo, useState } from 'react';
import { Home, PlusSquare, SlidersHorizontal, UserRound } from 'lucide-react';
import { deriveKey, getSalt } from '../lib/crypto';
import { shareRoomInvite } from '../lib/share';
import { supabase } from '../lib/supabase';
import {
  Avatar,
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  PasswordField,
  RoomCard,
  SearchBarPill,
} from './ui';

interface Room {
  id: string;
  name: string;
  age_group: string;
  category: string;
  require_password_every_time: boolean;
  created_at: string;
}

interface RoomListProps {
  onJoinRoom: (room: {
    id: string;
    name: string;
    key: CryptoKey;
    requirePasswordEveryTime?: boolean;
  }) => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
  invitedRoomId?: string | null;
  onInviteHandled?: () => void;
}

const FILTER_OPTIONS = [
  { id: 'featured', label: 'Em alta' },
  { id: 'new', label: 'Novas' },
  { id: 'private', label: 'Privadas' },
  { id: '+18', label: '+18' },
  { id: 'view-once', label: 'Visualizacao unica' },
] as const;

export default function RoomList({
  onJoinRoom,
  onOpenProfile,
  onOpenCreate,
  invitedRoomId = null,
  onInviteHandled,
}: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userProfile, setUserProfile] = useState<{ age_group: string; full_name: string | null; username: string; avatar_url?: string } | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]);
  const [accessReady, setAccessReady] = useState(false);
  const [roomMemberCounts, setRoomMemberCounts] = useState<Record<string, number>>({});
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTER_OPTIONS)[number]['id']>('featured');

  useEffect(() => {
    void fetchProfile();
    void fetchRooms();
    void fetchUserAccess();
    void fetchRoomMemberCounts();
  }, []);

  useEffect(() => {
    if (!invitedRoomId || rooms.length === 0 || !accessReady) {
      return;
    }

    const invitedRoom = rooms.find((room) => room.id === invitedRoomId);
    if (!invitedRoom) {
      return;
    }

    void tryJoinDirectly(invitedRoom);
    onInviteHandled?.();
  }, [accessReady, invitedRoomId, onInviteHandled, rooms, userAccess]);

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('age_group, full_name, username')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserProfile({
          ...data,
          avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '',
        });
      }
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (data) {
      setRooms(data);
    }
  };

  const fetchUserAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase.from('room_access').select('room_id').eq('user_id', user.id);
      if (data) {
        setUserAccess(data.map((access) => access.room_id));
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

  const registerAccess = async (roomId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('room_access')
        .upsert({ user_id: user.id, room_id: roomId }, { onConflict: 'user_id, room_id' });

      setUserAccess((current) => [...new Set([...current, roomId])]);
    }
  };

  const tryJoinDirectly = async (room: Room) => {
    const savedKey = sessionStorage.getItem(`room_key_${room.id}`);
    const hasAccess = userAccess.includes(room.id);

    if (hasAccess && !room.require_password_every_time && savedKey) {
      const salt = getSalt(room.id);
      const key = await deriveKey(savedKey, salt);
      onJoinRoom({
        id: room.id,
        name: room.name,
        key,
        requirePasswordEveryTime: room.require_password_every_time,
      });
      return;
    }

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

    const salt = getSalt(room.id);
    const key = await deriveKey(inputKey, salt);
    sessionStorage.setItem(`room_key_${room.id}`, inputKey);
    await registerAccess(room.id);
    onJoinRoom({
      id: room.id,
      name: room.name,
      key,
      requirePasswordEveryTime: room.require_password_every_time,
    });
  };

  const filteredRooms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const nextRooms = rooms.filter((room) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        room.name.toLowerCase().includes(normalizedSearch) ||
        room.category.toLowerCase().includes(normalizedSearch) ||
        room.id.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        selectedFilter === 'featured' ||
        selectedFilter === 'new' ||
        selectedFilter === 'view-once' ||
        (selectedFilter === 'private' && room.require_password_every_time) ||
        (selectedFilter === '+18' && room.age_group === '+18');

      return matchesSearch && matchesFilter;
    });

    if (selectedFilter === 'featured') {
      return nextRooms.sort((left, right) => (roomMemberCounts[right.id] ?? 0) - (roomMemberCounts[left.id] ?? 0));
    }

    if (selectedFilter === 'new') {
      return nextRooms.sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
    }

    return nextRooms;
  }, [roomMemberCounts, rooms, searchTerm, selectedFilter]);

  const greetingName =
    userProfile?.full_name?.split(' ')[0] ||
    userProfile?.username ||
    'Usuario';

  return (
    <div className="page-shell home-page">
      <main className="page-container page-stack home-main">
        <section className="home-hero">
          <div className="home-greeting">
            <div className="section-stack section-stack--sm">
              <h1 className="home-greeting__title">Hi, {greetingName} 👋</h1>
              <p className="home-greeting__subtitle">Converse com privacidade</p>
            </div>

            <div className="home-greeting__actions">
              <button type="button" className="home-avatar-button" onClick={onOpenProfile} aria-label="Abrir perfil">
                <Avatar fallback={greetingName} size="md" src={userProfile?.avatar_url || undefined} />
              </button>
            </div>
          </div>

          <SearchBarPill
            label="Buscar salas"
            placeholder="Buscar salas, codigos ou usuarios"
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
            <div>
              <p className="home-section-title">Em alta</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenCreate}>
              Ver mais
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

        <section className="page-stack">
          <div className="room-grid home-room-grid">
            {filteredRooms.map((room) => {
              const directAccess =
                userAccess.includes(room.id) &&
                !room.require_password_every_time &&
                Boolean(sessionStorage.getItem(`room_key_${room.id}`));

              const summary = room.require_password_every_time
                ? 'Sala privada · com senha'
                : `Sala segura · ${room.category.toLowerCase()}`;

              const featureLabel = room.require_password_every_time
                ? 'Senha recorrente'
                : 'Visualizacao unica';

              const accessLabel = directAccess ? 'Acesso salvo' : 'Com senha';
              const presenceCount = roomMemberCounts[room.id] ?? 0;
              const presenceLabel = presenceCount === 1 ? 'pessoa online' : 'pessoas online';

              return (
                <RoomCard
                  key={room.id}
                  name={room.name}
                  roomId={room.id}
                  category={room.category}
                  ageGroup={room.age_group}
                  summary={summary}
                  featureLabel={featureLabel}
                  accessLabel={accessLabel}
                  presenceCount={presenceCount}
                  presenceLabel={presenceLabel}
                  selected={joiningRoomId === room.id}
                  directAccess={directAccess}
                  locked={!directAccess}
                  onShare={() => {
                    void shareRoomInvite({
                      roomId: room.id,
                      roomName: room.name,
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
                      .catch((error: any) => {
                        if (error?.name !== 'AbortError') {
                          alert('Nao foi possivel compartilhar o convite.');
                        }
                      });
                  }}
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

          {filteredRooms.length === 0 ? (
            <Card className="empty-state">
              <Badge variant="warning">Vazio</Badge>
              <h3 className="topbar__title">Nenhuma sala encontrada</h3>
              <p className="text-muted">Ajuste a busca ou escolha outra categoria.</p>
            </Card>
          ) : null}
        </section>
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

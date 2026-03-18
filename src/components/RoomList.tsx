import { useEffect, useState } from 'react';
import { Home, LogOut, PlusSquare, UserRound } from 'lucide-react';
import { deriveKey, getSalt } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import {
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  HeroLogoBlock,
  IconButton,
  OnlineCount,
  PasswordField,
  RoomCard,
  SearchBarPill,
  TimerPill,
  Topbar,
} from './ui';

interface Room {
  id: string;
  name: string;
  age_group: string;
  category: string;
  require_password_every_time: boolean;
}

interface RoomListProps {
  onJoinRoom: (room: { id: string; name: string; key: CryptoKey }) => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
}

const CATEGORIES = ['Geral', 'Tecnologia', 'Lazer', 'Trabalho', 'Privado', '+18'];

export default function RoomList({ onJoinRoom, onOpenProfile, onOpenCreate }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userProfile, setUserProfile] = useState<{ age_group: string; full_name: string | null } | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  useEffect(() => {
    void fetchProfile();
    void fetchRooms();
    void fetchUserAccess();
  }, []);

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('age_group, full_name')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserProfile(data);
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
      onJoinRoom({ id: room.id, name: room.name, key });
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
    onJoinRoom({ id: room.id, name: room.name, key });
  };

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || room.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page-shell">
      <Topbar
        title="Home"
        subtitle="Descubra salas efêmeras e entre com chave persistente."
        trailing={
          <>
            <Button variant="ghost" size="sm" leadingIcon={<PlusSquare size={16} />} onClick={onOpenCreate}>
              Criar sala
            </Button>
            <IconButton icon={<UserRound size={18} />} label="Abrir perfil" onClick={onOpenProfile} />
            <IconButton icon={<LogOut size={18} />} label="Sair" variant="danger" onClick={() => void supabase.auth.signOut()} />
          </>
        }
      />

      <main className="page-container page-stack">
        <HeroLogoBlock
          eyebrow="Sala de descoberta"
          title={
            <>
              Chat<span className="hero-logo__accent">Cripto</span>
            </>
          }
          subtitle={`Olá${userProfile?.full_name ? `, ${userProfile.full_name.split(' ')[0]}` : ''}. Acesso ${
            userProfile?.age_group === '+18' ? 'premium com salas adultas liberadas.' : 'seguro com filtros móveis ativos.'
          }`}
          meta={
            <>
              <TimerPill label="Mensagens expiram em 20 min" />
              <OnlineCount count={filteredRooms.length} />
              <Badge variant={userProfile?.age_group === '+18' ? 'danger' : 'success'}>
                {userProfile?.age_group ?? 'Livre'}
              </Badge>
            </>
          }
        />

        <Card className="page-stack">
          <div className="toolbar-row">
            <SearchBarPill value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <Button variant="primary" leadingIcon={<PlusSquare size={18} />} onClick={onOpenCreate}>
              Nova sala
            </Button>
          </div>
          <div className="toolbar-row">
            {['Todas', ...CATEGORIES].map((category) => (
              <Chip
                key={category}
                selected={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Chip>
            ))}
          </div>
        </Card>

        <section className="page-stack">
          <div className="toolbar-row">
            <p className="eyebrow">Salas protegidas</p>
            <Badge variant="info">{filteredRooms.length} visíveis</Badge>
          </div>

          <div className="room-grid">
            {filteredRooms.map((room) => {
              const directAccess =
                userAccess.includes(room.id) &&
                !room.require_password_every_time &&
                Boolean(sessionStorage.getItem(`room_key_${room.id}`));

              return (
                <RoomCard
                  key={room.id}
                  name={room.name}
                  roomId={room.id}
                  category={room.category}
                  ageGroup={room.age_group}
                  selected={joiningRoomId === room.id}
                  directAccess={directAccess}
                  locked={!directAccess}
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
                          <Button type="submit">Entrar agora</Button>
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
              <p className="text-muted">Ajuste a busca ou o filtro para localizar uma sala protegida.</p>
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

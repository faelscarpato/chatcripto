import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock3,
  Globe2,
  Home,
  KeyRound,
  Link2,
  PlusSquare,
  ShieldCheck,
  UserRound,
  UserSquare2,
} from 'lucide-react';
import { deriveKey, deriveRoomPasswordVerifier, getSalt } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import type { ActiveRoom, RoomTtlMinutes, RoomVisibility } from '../types/rooms';
import {
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  PasswordField,
  RadioCard,
  TimerPill,
} from './ui';

interface CreateRoomProps {
  onJoinRoom: (room: ActiveRoom) => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
}

const CATEGORIES = ['Geral', 'Tecnologia', 'Lazer', 'Trabalho', 'Privado', '+18'];
const TIMER_OPTIONS: RoomTtlMinutes[] = [5, 10, 15, 20];

const VISIBILITY_OPTIONS: Array<{
  value: RoomVisibility;
  title: string;
  description: string;
  icon: typeof Globe2;
}> = [
  {
    value: 'public',
    title: 'Publica',
    description: 'Aparece na comunidade e pode ser descoberta por busca.',
    icon: Globe2,
  },
  {
    value: 'unlisted',
    title: 'Nao listada',
    description: 'Fica fora da comunidade e entra por link ou codigo.',
    icon: Link2,
  },
  {
    value: 'personal',
    title: 'Pessoal',
    description: 'Fica visivel apenas para o criador.',
    icon: UserSquare2,
  },
];

const VISIBILITY_BADGES: Record<RoomVisibility, 'public' | 'unlisted' | 'personal'> = {
  public: 'public',
  unlisted: 'unlisted',
  personal: 'personal',
};

const VISIBILITY_LABELS: Record<RoomVisibility, string> = {
  public: 'Publica',
  unlisted: 'Nao listada',
  personal: 'Pessoal',
};

export default function CreateRoom({ onJoinRoom, onNavigateHome, onNavigateProfile }: CreateRoomProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ age_group: 'Livre' | '+18' } | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomKey, setNewRoomKey] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('Geral');
  const [newRoomVisibility, setNewRoomVisibility] = useState<RoomVisibility>('public');
  const [messageTtlMinutes, setMessageTtlMinutes] = useState<RoomTtlMinutes>(20);
  const [requirePassEveryTime, setRequirePassEveryTime] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase.from('profiles').select('age_group').eq('id', user.id).single();
      if (data) {
        setUserProfile(data);
      }
    }

    setLoading(false);
  };

  const registerAccess = async (roomId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from('room_access').upsert(
        {
          user_id: user.id,
          room_id: roomId,
          role: 'owner',
          is_favorite: false,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, room_id' },
      );
    }
  };

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert('Sessao expirada. Entre novamente para criar uma sala.');
      return;
    }

    setSubmitting(true);

    const roomId = crypto.randomUUID();
    const passwordVerifier = await deriveRoomPasswordVerifier(newRoomKey, roomId);
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          id: roomId,
          name: newRoomName.trim(),
          description: newRoomDescription.trim() || null,
          created_by: user.id,
          age_group: userProfile.age_group,
          category: newRoomCategory,
          visibility: newRoomVisibility,
          message_ttl_minutes: messageTtlMinutes,
          require_password_every_time: requirePassEveryTime,
          password_verifier: passwordVerifier,
          last_activity_at: nowIso,
        },
      ])
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      alert(error.message);
      return;
    }

    if (data) {
      const salt = getSalt(data.id);
      const key = await deriveKey(newRoomKey, salt);
      await registerAccess(data.id);
      sessionStorage.setItem(`room_key_${data.id}`, newRoomKey);
      onJoinRoom({
        id: data.id,
        name: data.name,
        key,
        requirePasswordEveryTime: data.require_password_every_time,
        visibility: data.visibility,
        messageTtlMinutes: data.message_ttl_minutes,
        createdBy: data.created_by,
        description: data.description,
        category: data.category,
      });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-container">
          <Card className="empty-state">
            <span className="ui-spinner" aria-hidden="true" />
            <p className="text-muted">Carregando permissoes de criacao...</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell create-page">
      <header className="create-header">
        <div className="create-header__inner">
          <IconButton
            icon={<ArrowLeft size={20} />}
            label="Voltar para home"
            variant="ghost"
            className="create-header__back"
            onClick={onNavigateHome}
          />
          <h1 className="create-header__title">Crie uma sala</h1>
          <span className="create-header__spacer" aria-hidden="true" />
        </div>
      </header>

      <main className="page-container page-stack create-main">
        <form className="page-stack create-form" onSubmit={createRoom}>
          <Card className="page-stack create-panel">
            <Input
              aria-label="Nome da sala"
              placeholder="Nome da sala"
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              maxLength={48}
              required
            />

            <Input
              aria-label="Descricao opcional"
              placeholder="Descricao da sala"
              value={newRoomDescription}
              onChange={(event) => setNewRoomDescription(event.target.value)}
              maxLength={120}
            />

            <section className="section-stack section-stack--sm">
              <h2 className="create-section-title">Visibilidade</h2>
              <div className="create-privacy-stack" role="radiogroup" aria-label="Visibilidade da sala">
                {VISIBILITY_OPTIONS.map((option) => (
                  <RadioCard
                    key={option.value}
                    icon={option.icon}
                    title={option.title}
                    description={option.description}
                    checked={newRoomVisibility === option.value}
                    badge={<Badge variant={VISIBILITY_BADGES[option.value]}>{option.title}</Badge>}
                    onClick={() => setNewRoomVisibility(option.value)}
                  />
                ))}
              </div>
            </section>

            <section className="section-stack section-stack--sm">
              <h2 className="create-section-title">Categoria</h2>
              <div className="create-category-row">
                {CATEGORIES.filter((category) => category !== '+18' || userProfile?.age_group === '+18').map((category) => (
                  <Chip
                    key={category}
                    selected={newRoomCategory === category}
                    onClick={() => setNewRoomCategory(category)}
                  >
                    {category}
                  </Chip>
                ))}
              </div>
            </section>

            <PasswordField
              label="Senha da sala"
              placeholder="Digite a senha da sala"
              value={newRoomKey}
              onChange={(event) => setNewRoomKey(event.target.value)}
              required
            />

            <section className="section-stack section-stack--sm">
              <h2 className="create-section-title">Timer das mensagens</h2>
              <div className="create-category-row">
                {TIMER_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    selected={messageTtlMinutes === minutes}
                    onClick={() => setMessageTtlMinutes(minutes)}
                  >
                    {minutes} min
                  </Chip>
                ))}
              </div>
            </section>

            <section className="section-stack section-stack--sm">
              <h2 className="create-section-title">Acesso recorrente</h2>
              <div className="create-privacy-stack" role="radiogroup" aria-label="Persistencia da senha">
                <RadioCard
                  icon={ShieldCheck}
                  title="Reusar acesso nesta conta"
                  description="Quem ja entrou pode voltar sem redigitar a senha, se a chave estiver salva nesta sessao."
                  checked={!requirePassEveryTime}
                  onClick={() => setRequirePassEveryTime(false)}
                />
                <RadioCard
                  icon={KeyRound}
                  title="Exigir senha sempre"
                  description="Pede a senha em toda reentrada, mesmo para quem ja entrou antes."
                  checked={requirePassEveryTime}
                  onClick={() => setRequirePassEveryTime(true)}
                />
              </div>
            </section>

            <Card className="create-timer-card create-preview-card">
              <div className="create-timer-card__body">
                <span className="create-timer-card__icon" aria-hidden="true">
                  <Clock3 size={20} />
                </span>
                <div className="section-stack section-stack--sm create-timer-card__copy">
                  <p className="create-timer-card__title">Preview rapido</p>
                  <div className="toolbar-row">
                    <Badge variant={VISIBILITY_BADGES[newRoomVisibility]}>{VISIBILITY_LABELS[newRoomVisibility]}</Badge>
                    <Badge variant={requirePassEveryTime ? 'warning' : 'info'}>
                      {requirePassEveryTime ? 'Senha sempre' : 'Acesso salvo'}
                    </Badge>
                    <Badge variant="muted">{newRoomCategory}</Badge>
                  </div>
                  <p className="create-timer-card__text">
                    Expira em {messageTtlMinutes} min{newRoomVisibility === 'personal' ? ' e fica visivel so para voce.' : '.'}
                  </p>
                </div>
              </div>
              <TimerPill minutes={messageTtlMinutes} variant="strong" />
            </Card>
          </Card>

          <Button
            type="submit"
            loading={submitting}
            leadingIcon={!submitting ? <ShieldCheck size={18} /> : null}
            className="create-submit"
          >
            Criar sala
          </Button>
        </form>
      </main>

      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: Home, onClick: onNavigateHome },
          { id: 'create', label: 'Criar', icon: PlusSquare, active: true, onClick: () => undefined },
          { id: 'profile', label: 'Perfil', icon: UserRound, onClick: onNavigateProfile },
        ]}
      />
    </div>
  );
}

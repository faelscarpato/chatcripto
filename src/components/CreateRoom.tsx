import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Home, KeyRound, LockKeyhole, PlusSquare, ShieldCheck, UserRound } from 'lucide-react';
import { deriveKey, getSalt } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import {
  BottomNav,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  PasswordField,
  PrivacyCardOption,
} from './ui';

interface CreateRoomProps {
  onJoinRoom: (room: { id: string; name: string; key: CryptoKey }) => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
}

const CATEGORIES = ['Geral', 'Tecnologia', 'Lazer', 'Trabalho', 'Privado', '+18'];

export default function CreateRoom({ onJoinRoom, onNavigateHome, onNavigateProfile }: CreateRoomProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ age_group: string } | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomKey, setNewRoomKey] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('Geral');
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
      await supabase
        .from('room_access')
        .upsert({ user_id: user.id, room_id: roomId }, { onConflict: 'user_id, room_id' });
    }
  };

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile) {
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          name: newRoomName,
          age_group: userProfile.age_group,
          category: newRoomCategory,
          require_password_every_time: requirePassEveryTime,
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
      onJoinRoom({ id: data.id, name: data.name, key });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-container">
          <Card className="empty-state">
            <span className="ui-spinner" aria-hidden="true" />
            <p className="text-muted">Carregando permissões de criação...</p>
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
              placeholder="Descrição (opcional)"
              value={newRoomDescription}
              onChange={(event) => setNewRoomDescription(event.target.value)}
              maxLength={120}
            />

            <section className="section-stack section-stack--sm">
              <h2 className="create-section-title">Privacidade</h2>
              <div className="create-privacy-stack">
                <PrivacyCardOption
                  icon={KeyRound}
                  title="Sala privada"
                  description="Para entrar e preciso ter senha."
                  selected={requirePassEveryTime}
                  trailing={<span className={`mini-switch ${requirePassEveryTime ? 'mini-switch--checked' : ''}`} aria-hidden="true" />}
                  onClick={() => setRequirePassEveryTime(true)}
                />
                <PrivacyCardOption
                  icon={LockKeyhole}
                  title="Sala publica"
                  description="A chave fica salva nesta sessao."
                  selected={!requirePassEveryTime}
                  trailing={<span className={`mini-switch ${!requirePassEveryTime ? 'mini-switch--checked mini-switch--public' : ''}`} aria-hidden="true" />}
                  onClick={() => setRequirePassEveryTime(false)}
                />
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

            <Card className="create-timer-card">
              <div className="create-timer-card__body">
                <span className="create-timer-card__icon" aria-hidden="true">
                  <Clock3 size={20} />
                </span>
                <div className="section-stack section-stack--sm create-timer-card__copy">
                  <p className="create-timer-card__title">Mensagens desaparecem</p>
                  <p className="create-timer-card__text">em 20 minutos</p>
                </div>
              </div>
              <span className="mini-switch mini-switch--checked" aria-hidden="true" />
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

import { useEffect, useState } from 'react';
import { Home, KeyRound, LockKeyhole, PlusSquare, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { deriveKey, getSalt } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import {
  Badge,
  BottomNav,
  Button,
  Card,
  HeroLogoBlock,
  Input,
  PasswordField,
  PrivacyCardOption,
  ToggleSwitch,
  Topbar,
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
    <div className="page-shell">
      <Topbar title="Criar sala" subtitle="Defina a camada de privacidade sem alterar o backend atual." />

      <main className="page-container page-stack">
        <HeroLogoBlock
          eyebrow="Create room"
          title={
            <>
              Sala<span className="hero-logo__accent">Efêmera</span>
            </>
          }
          subtitle="A navegação principal ficou em 3 itens: Home, Criar e Perfil. Não existe domínio de atividade no projeto atual, então criação tem prioridade de frequência sobre uma aba redundante."
          meta={
            <>
              <Badge variant="info">BottomNav 3 itens</Badge>
              <Badge variant={userProfile?.age_group === '+18' ? 'danger' : 'success'}>
                {userProfile?.age_group ?? 'Livre'}
              </Badge>
            </>
          }
        />

        <form className="page-stack" onSubmit={createRoom}>
          <Card className="page-stack">
            <Input
              label="Nome público"
              icon={<PlusSquare size={18} />}
              placeholder="Ex: Mesa segura do time"
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              required
            />

            <PasswordField
              label="Chave da sala"
              placeholder="Senha secreta usada para derivar a chave"
              value={newRoomKey}
              onChange={(event) => setNewRoomKey(event.target.value)}
              required
            />

            <label className="ui-field">
              <span className="ui-field__label">Categoria</span>
              <select
                className="ui-select"
                value={newRoomCategory}
                onChange={(event) => setNewRoomCategory(event.target.value)}
              >
                {CATEGORIES.filter((category) => category !== '+18' || userProfile?.age_group === '+18').map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <div className="privacy-grid">
            <PrivacyCardOption
              icon={ShieldCheck}
              title="Acesso persistente"
              description="A chave fica salva apenas nesta sessão para permitir entrada direta em próximas visitas."
              selected={!requirePassEveryTime}
              badge={<Badge variant="primary">Padrão</Badge>}
              onClick={() => setRequirePassEveryTime(false)}
            />
            <PrivacyCardOption
              icon={KeyRound}
              title="Senha a cada acesso"
              description="Força nova autenticação com senha em toda entrada, útil para salas sensíveis ou compartilhadas."
              selected={requirePassEveryTime}
              badge={<Badge variant="warning">Lock</Badge>}
              onClick={() => setRequirePassEveryTime(true)}
            />
            <PrivacyCardOption
              icon={Sparkles}
              title="Mensagens efêmeras"
              description="O chat já nasce com retenção de 20 minutos e mídia view-once compatível."
              selected
              badge={<Badge variant="info">20 min</Badge>}
            />
            <Card className="section-stack">
              <ToggleSwitch
                checked={requirePassEveryTime}
                onCheckedChange={setRequirePassEveryTime}
                label="Exigir senha em cada acesso"
                description="Liga o estado locked por padrão em todos os acessos futuros."
                icon={<LockKeyhole size={18} />}
              />
            </Card>
          </div>

          <Button type="submit" loading={submitting} leadingIcon={!submitting ? <ShieldCheck size={18} /> : null}>
            Criar sala e entrar
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

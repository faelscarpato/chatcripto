import { useEffect, useState } from 'react';
import { CalendarDays, CreditCard, Home, LogOut, MapPin, PlusSquare, Save, Trash2, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Avatar,
  Badge,
  BottomNav,
  Button,
  Card,
  Input,
  SettingsRow,
  StatsCard,
  Topbar,
} from './ui';

interface ProfileData {
  id: string;
  username: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  address: string | null;
  age_group: 'Livre' | '+18';
}

interface ProfileProps {
  onNavigateHome: () => void;
  onNavigateCreate: () => void;
}

export default function Profile({ onNavigateHome, onNavigateCreate }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState('');
  const [accessCount, setAccessCount] = useState(0);
  const [formData, setFormData] = useState<Partial<ProfileData>>({});

  useEffect(() => {
    void fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setEmail(user.email ?? '');

      const [{ data, error }, { count }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('room_access').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      if (error) {
        throw error;
      }

      setAccessCount(count ?? 0);
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        address: data.address || '',
      });
    } catch (error: any) {
      alert('Erro ao carregar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateAgeGroup = (birthDateString: string): 'Livre' | '+18' => {
    if (!birthDateString) {
      return 'Livre';
    }

    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthOffset = today.getMonth() - birthDate.getMonth();

    if (monthOffset < 0 || (monthOffset === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 18 ? '+18' : 'Livre';
  };

  const completionScore = ['full_name', 'cpf', 'birth_date', 'address'].filter((key) => {
    const value = formData[key as keyof typeof formData];
    return Boolean(value);
  }).length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setSaving(true);

    try {
      const age_group = calculateAgeGroup(formData.birth_date || '');
      const updates = {
        ...formData,
        age_group,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (error) {
        throw error;
      }

      setProfile({ ...profile, ...updates } as ProfileData);
      alert('Perfil atualizado com sucesso!');
    } catch (error: any) {
      alert('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-container">
          <Card className="empty-state">
            <span className="ui-spinner" aria-hidden="true" />
            <p className="text-muted">Carregando perfil seguro...</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Topbar title="Perfil" subtitle="Gerencie identidade, acesso e preferências sensíveis." />

      <main className="page-container page-stack">
        <Card className="profile-hero">
          <div className="toolbar-row">
            <Avatar fallback={profile?.username ?? 'U'} size="lg" />
            <div className="section-stack section-stack--sm">
              <p className="eyebrow">Hero profile</p>
              <h1 className="hero-logo__title">{profile?.username}</h1>
              <p className="text-muted">{email}</p>
              <div className="toolbar-row">
                <Badge variant={profile?.age_group === '+18' ? 'danger' : 'success'}>
                  {profile?.age_group === '+18' ? 'Maior de idade' : 'Livre'}
                </Badge>
                <Badge variant="info">{accessCount} salas acessadas</Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="stats-grid">
          <StatsCard label="Completude" value={`${completionScore}/4`} description="Campos críticos preenchidos no cadastro." />
          <StatsCard label="Acessos" value={String(accessCount)} description="Histórico de salas já destravadas pelo perfil." />
        </div>

        <Card className="section-stack">
          <SettingsRow
            title="Usuário"
            description={profile?.username ?? 'Sem username'}
            icon={<UserRound size={18} />}
            end={<Badge variant="muted">Readonly</Badge>}
          />
          <SettingsRow
            title="E-mail"
            description={email}
            icon={<CreditCard size={18} />}
            end={<Badge variant="info">Auth</Badge>}
          />
        </Card>

        <Card>
          <form className="page-stack" onSubmit={handleSubmit}>
            <Input
              label="Nome completo"
              placeholder="Seu nome real"
              value={formData.full_name || ''}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
            />

            <div className="profile-grid">
              <Input
                label="CPF"
                icon={<CreditCard size={18} />}
                placeholder="000.000.000-00"
                value={formData.cpf || ''}
                onChange={(event) => setFormData({ ...formData, cpf: event.target.value })}
              />
              <Input
                label="Nascimento"
                type="date"
                icon={<CalendarDays size={18} />}
                value={formData.birth_date || ''}
                onChange={(event) => setFormData({ ...formData, birth_date: event.target.value })}
              />
            </div>

            <Input
              label="Endereço"
              icon={<MapPin size={18} />}
              placeholder="Rua, número, bairro e cidade"
              value={formData.address || ''}
              onChange={(event) => setFormData({ ...formData, address: event.target.value })}
            />

            <Button type="submit" loading={saving} leadingIcon={!saving ? <Save size={18} /> : null}>
              Salvar alterações
            </Button>
          </form>
        </Card>

        <Card tone="danger" className="section-stack">
          <div className="section-stack section-stack--sm">
            <p className="eyebrow">Danger zone</p>
            <h3 className="topbar__title">Ações críticas</h3>
            <p className="text-muted">
              O backend atual já suporta logout. Exclusão de conta ainda exige endpoint administrativo seguro.
            </p>
          </div>
          <div className="toolbar-row">
            <Button variant="secondary" leadingIcon={<LogOut size={18} />} onClick={() => void supabase.auth.signOut()}>
              Sair agora
            </Button>
            <Button
              variant="danger"
              leadingIcon={<Trash2 size={18} />}
              onClick={() => alert('A exclusão de conta depende de um endpoint administrativo não presente no projeto atual.')}
            >
              Deletar conta
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: Home, onClick: onNavigateHome },
          { id: 'create', label: 'Criar', icon: PlusSquare, onClick: onNavigateCreate },
          { id: 'profile', label: 'Perfil', icon: UserRound, active: true, onClick: () => undefined },
        ]}
      />
    </div>
  );
}

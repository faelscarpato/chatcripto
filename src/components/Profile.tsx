import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  CreditCard,
  Home,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  PlusSquare,
  Save,
  Shield,
  Trash2,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Avatar,
  BottomNav,
  Button,
  Card,
  IconButton,
  Input,
  SettingsRow,
  StatsCard,
} from './ui';

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [formData, setFormData] = useState<Partial<ProfileData>>({});
  const [pendingAvatarSrc, setPendingAvatarSrc] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchProfile();
  }, []);

  const buildAvatarDataUrl = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'));
        nextImage.src = imageUrl;
      });

      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Nao foi possivel preparar a imagem.');
      }

      const sourceSize = Math.min(image.width, image.height);
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;

      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setEmail(user.email ?? '');
      const authAvatar = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : '';

      const [{ data, error }, { count }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('room_access').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      if (error) {
        throw error;
      }

      const profileAvatar = typeof data.avatar_url === 'string' ? data.avatar_url : '';
      const hasOversizedAuthAvatar = authAvatar.startsWith('data:image/');
      const nextAvatar = profileAvatar || authAvatar;

      if (hasOversizedAuthAvatar) {
        await Promise.allSettled([
          profileAvatar
            ? Promise.resolve()
            : supabase.from('profiles').update({ avatar_url: authAvatar }).eq('id', user.id),
          supabase.auth.updateUser({
            data: {
              avatar_url: '',
            },
          }),
        ]);
        await supabase.auth.refreshSession();
      }

      setAccessCount(count ?? 0);
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        address: data.address || '',
      });
      setPendingAvatarSrc(nextAvatar);
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

  const displayName = profile?.full_name?.trim() || profile?.username || 'Usuario';
  const usernameHandle = profile?.username ? `@${profile.username}` : '@usuario';
  const ageDescription = profile?.age_group === '+18' ? 'Perfil adulto verificado' : 'Perfil livre';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) {
      return;
    }

    setSaving(true);

    try {
      const age_group = calculateAgeGroup(formData.birth_date || '');
      const updates = {
        full_name: formData.full_name || '',
        cpf: formData.cpf || '',
        birth_date: formData.birth_date || '',
        address: formData.address || '',
        age_group,
        avatar_url: pendingAvatarSrc || null,
      };

      const { error: profileError } = await supabase.from('profiles').update(updates).eq('id', profile.id);

      if (profileError) {
        throw profileError;
      }

      setProfile({ ...profile, ...updates } as ProfileData);
      alert('Perfil atualizado com sucesso!');
    } catch (error: any) {
      alert('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A foto deve ter no maximo 5MB.');
      event.target.value = '';
      return;
    }

    try {
      const nextAvatar = await buildAvatarDataUrl(file);
      setPendingAvatarSrc(nextAvatar);
    } catch (error: any) {
      alert('Erro ao preparar a foto: ' + error.message);
    } finally {
      event.target.value = '';
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
    <div className="page-shell profile-page">
      <header className="profile-header">
        <div className="profile-header__inner">
          <IconButton
            icon={<ArrowLeft size={20} />}
            label="Voltar para home"
            variant="ghost"
            className="profile-header__back"
            onClick={onNavigateHome}
          />
          <span className="profile-header__spacer" aria-hidden="true" />
          <Avatar fallback={displayName} size="sm" src={pendingAvatarSrc || undefined} />
        </div>
      </header>

      <main className="page-container page-stack profile-main">
        <section className="profile-hero">
          <div className="profile-avatar-stage">
            <div className="profile-avatar-ring" aria-hidden="true" />
            <Avatar fallback={displayName} size="lg" src={pendingAvatarSrc || undefined} />
            <button
              type="button"
              className="profile-avatar-edit"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Selecionar foto de perfil"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarSelect}
            />
          </div>

          <div className="section-stack section-stack--sm profile-hero__copy">
            <div className="toolbar-row profile-hero__title-row">
              <h1 className="profile-hero__title">{displayName}</h1>
              <Pencil size={18} className="profile-hero__edit-icon" />
            </div>
            <p className="profile-hero__handle">{usernameHandle}</p>
            <p className="profile-hero__subtitle">{ageDescription}</p>
            <p className="profile-hero__email">{email}</p>
          </div>
        </section>

        <div className="profile-settings-stack">
          <SettingsRow
            title="Segurança"
            description="Sessao protegida e acesso cifrado."
            icon={<Shield size={18} />}
            end={<ChevronRight size={18} />}
          />
          <SettingsRow
            title="Notificações"
            description="Avisos visuais dentro do app."
            icon={<Bell size={18} />}
            end={
              <button
                type="button"
                className={`mini-switch ${notificationsEnabled ? 'mini-switch--checked' : ''}`}
                aria-label="Alternar notificacoes"
                aria-pressed={notificationsEnabled}
                onClick={() => setNotificationsEnabled((current) => !current)}
              />
            }
          />
          <SettingsRow
            title="Privacidade"
            description="Mensagens efemeras e midia view-once."
            icon={<LockKeyhole size={18} />}
            end={<ChevronRight size={18} />}
          />
        </div>

        <div className="stats-grid profile-stats-grid">
          <StatsCard label="Completude" value={`${completionScore}/4`} description="Campos essenciais preenchidos." />
          <StatsCard label="Acessos" value={String(accessCount)} description="Salas liberadas nesta conta." />
        </div>

        <div className="profile-cta-stack">
          <Button fullWidth leadingIcon={<LogOut size={18} />} onClick={() => void supabase.auth.signOut()}>
            Sair
          </Button>
          <Button
            variant="danger"
            fullWidth
            leadingIcon={<Trash2 size={18} />}
            onClick={() => alert('A exclusão de conta depende de um endpoint administrativo não presente no projeto atual.')}
          >
            Deletar conta
          </Button>
        </div>

        <Card className="section-stack profile-edit-card">
          <div className="section-stack section-stack--sm">
            <p className="eyebrow">Dados da conta</p>
            <h2 className="topbar__title">Editar perfil</h2>
          </div>
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

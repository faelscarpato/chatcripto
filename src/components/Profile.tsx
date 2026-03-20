import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  Check,
  Bell,
  CalendarDays,
  ChevronRight,
  Copy,
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
import { DEFAULT_PROFILE_EMOJI, PROFILE_EMOJI_OPTIONS, normalizeProfileEmoji } from '../lib/profileEmoji';
import { copyRoomInvite } from '../lib/share';
import { supabase } from '../lib/supabase';
import type { RoomTtlMinutes, RoomVisibility } from '../types/rooms';
import {
  Avatar,
  Badge,
  BottomNav,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  SettingsRow,
  StatsCard,
  TimerPill,
} from './ui';

interface ProfileData {
  id: string;
  username: string;
  profile_emoji: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  address: string | null;
  age_group: 'Livre' | '+18';
}

interface OwnedRoom {
  id: string;
  name: string;
  description: string | null;
  category: string;
  age_group: 'Livre' | '+18';
  visibility: RoomVisibility;
  message_ttl_minutes: RoomTtlMinutes;
  require_password_every_time: boolean;
  is_archived: boolean;
  created_at: string;
  created_by: string | null;
}

interface RoomDraft {
  name: string;
  description: string;
  category: string;
  visibility: RoomVisibility;
  message_ttl_minutes: RoomTtlMinutes;
  is_archived: boolean;
}

const ROOM_CATEGORIES = ['Geral', 'Tecnologia', 'Lazer', 'Trabalho', 'Privado', '+18'];
const ROOM_TTL_OPTIONS: RoomTtlMinutes[] = [5, 10, 15, 20];
const ROOM_VISIBILITY_OPTIONS: RoomVisibility[] = ['public', 'unlisted', 'personal'];

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
  const [ownedRooms, setOwnedRooms] = useState<OwnedRoom[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomDrafts, setRoomDrafts] = useState<Record<string, RoomDraft>>({});
  const [roomActionId, setRoomActionId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [formData, setFormData] = useState<Partial<ProfileData>>({});
  const [pendingEmoji, setPendingEmoji] = useState(DEFAULT_PROFILE_EMOJI);

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

      const [{ data, error }, { count }, { data: roomsData, error: roomsError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('room_access').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('rooms')
          .select('id, name, description, category, age_group, visibility, message_ttl_minutes, require_password_every_time, is_archived, created_at, created_by')
          .eq('created_by', user.id)
          .order('last_activity_at', { ascending: false }),
      ]);

      if (error) {
        throw error;
      }

      if (roomsError) {
        throw roomsError;
      }

      setAccessCount(count ?? 0);
      setProfile({ ...data, profile_emoji: normalizeProfileEmoji(data.profile_emoji) });
      setOwnedRooms((roomsData as OwnedRoom[] | null) ?? []);
      setRoomDrafts(
        ((roomsData as OwnedRoom[] | null) ?? []).reduce<Record<string, RoomDraft>>((accumulator, room) => {
          accumulator[room.id] = {
            name: room.name,
            description: room.description || '',
            category: room.category,
            visibility: room.visibility,
            message_ttl_minutes: room.message_ttl_minutes,
            is_archived: room.is_archived,
          };
          return accumulator;
        }, {}),
      );
      setFormData({
        full_name: data.full_name || '',
        cpf: data.cpf || '',
        birth_date: data.birth_date || '',
        address: data.address || '',
      });
      setPendingEmoji(normalizeProfileEmoji(data.profile_emoji));
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
  const roomCategoryOptions = ROOM_CATEGORIES.filter((category) => category !== '+18' || profile?.age_group === '+18');

  const beginRoomEdit = (room: OwnedRoom) => {
    setRoomDrafts((current) => ({
      ...current,
      [room.id]: {
        name: room.name,
        description: room.description || '',
        category: room.category,
        visibility: room.visibility,
        message_ttl_minutes: room.message_ttl_minutes,
        is_archived: room.is_archived,
      },
    }));
    setEditingRoomId(room.id);
  };

  const cancelRoomEdit = (room: OwnedRoom) => {
    setRoomDrafts((current) => ({
      ...current,
      [room.id]: {
        name: room.name,
        description: room.description || '',
        category: room.category,
        visibility: room.visibility,
        message_ttl_minutes: room.message_ttl_minutes,
        is_archived: room.is_archived,
      },
    }));
    setEditingRoomId((current) => (current === room.id ? null : current));
  };

  const saveRoomChanges = async (roomId: string) => {
    const draft = roomDrafts[roomId];
    if (!draft?.name.trim()) {
      alert('Informe um nome para a sala.');
      return;
    }

    setRoomActionId(roomId);

    try {
      const updates = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category: draft.category,
        visibility: draft.visibility,
        message_ttl_minutes: draft.message_ttl_minutes,
        is_archived: draft.is_archived,
      };

      const { error } = await supabase.from('rooms').update(updates).eq('id', roomId);
      if (error) {
        throw error;
      }

      setOwnedRooms((current) =>
        current.map((room) => (room.id === roomId ? { ...room, ...updates } : room)),
      );
      setEditingRoomId((current) => (current === roomId ? null : current));
    } catch (error: any) {
      alert('Erro ao atualizar sala: ' + error.message);
    } finally {
      setRoomActionId(null);
    }
  };

  const toggleRoomArchive = async (room: OwnedRoom) => {
    const nextArchived = !room.is_archived;
    setRoomActionId(room.id);

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ is_archived: nextArchived })
        .eq('id', room.id);

      if (error) {
        throw error;
      }

      setOwnedRooms((current) =>
        current.map((item) =>
          item.id === room.id ? { ...item, is_archived: nextArchived } : item,
        ),
      );
    } catch (error: any) {
      alert('Erro ao arquivar a sala: ' + error.message);
    } finally {
      setRoomActionId(null);
    }
  };

  const copyInviteLink = async (room: OwnedRoom) => {
    try {
      await copyRoomInvite({
        roomId: room.id,
        visibility: room.visibility,
        requirePasswordEveryTime: room.require_password_every_time,
      });
      alert(
        room.require_password_every_time
          ? 'Link copiado. Envie a senha da sala separadamente.'
          : 'Link copiado para a area de transferencia.',
      );
    } catch {
      alert('Nao foi possivel copiar o convite desta sala.');
    }
  };

  const deleteRoom = async (room: OwnedRoom) => {
    const confirmed = window.confirm(`Apagar a sala "${room.name}"? Essa ação remove mensagens e acessos vinculados.`);
    if (!confirmed) {
      return;
    }

    setRoomActionId(room.id);

    try {
      const { error } = await supabase.from('rooms').delete().eq('id', room.id);
      if (error) {
        throw error;
      }

      setOwnedRooms((current) => current.filter((item) => item.id !== room.id));
      setRoomDrafts((current) => {
        const next = { ...current };
        delete next[room.id];
        return next;
      });
      setEditingRoomId((current) => (current === room.id ? null : current));
    } catch (error: any) {
      alert('Erro ao apagar sala: ' + error.message);
    } finally {
      setRoomActionId(null);
    }
  };

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
        profile_emoji: normalizeProfileEmoji(pendingEmoji),
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
          <Avatar fallback={displayName} size="sm" emoji={pendingEmoji} />
        </div>
      </header>

      <main className="page-container page-stack profile-main">
        <section className="profile-hero">
          <div className="profile-avatar-stage">
            <div className="profile-avatar-ring" aria-hidden="true" />
            <Avatar fallback={displayName} size="lg" emoji={pendingEmoji} />
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
          <StatsCard label="Criadas" value={String(ownedRooms.length)} description="Salas gerenciadas por voce." />
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
            <div className="section-stack section-stack--sm">
              <span className="ui-field__label">Emoji do perfil</span>
              <div className="profile-emoji-grid" role="list" aria-label="Selecionar emoji do perfil">
                {PROFILE_EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`profile-emoji-option ${pendingEmoji === emoji ? 'profile-emoji-option--active' : ''}`}
                    onClick={() => setPendingEmoji(emoji)}
                    aria-pressed={pendingEmoji === emoji}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>
              <p className="text-muted profile-emoji-hint">
                Use um emoji leve como identidade visual. Fotos podem ser enviadas apenas dentro do chat.
              </p>
            </div>

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

        <Card className="section-stack profile-rooms-card">
          <div className="profile-rooms-card__header">
            <div className="section-stack section-stack--sm">
              <p className="eyebrow">Gestão de salas</p>
              <h2 className="topbar__title">Salas criadas por você</h2>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<PlusSquare size={16} />}
              onClick={onNavigateCreate}
            >
              Nova sala
            </Button>
          </div>

          {ownedRooms.length === 0 ? (
            <div className="profile-rooms-empty">
              <p className="text-muted">
                Você ainda não criou nenhuma sala. Quando criar, poderá editar, privar, abrir ou apagar por aqui.
              </p>
            </div>
          ) : (
            <div className="profile-room-list">
              {ownedRooms.map((room) => {
                const draft = roomDrafts[room.id] ?? {
                  name: room.name,
                  description: room.description || '',
                  category: room.category,
                  visibility: room.visibility,
                  message_ttl_minutes: room.message_ttl_minutes,
                  is_archived: room.is_archived,
                };
                const isEditing = editingRoomId === room.id;
                const isBusy = roomActionId === room.id;

                return (
                  <Card key={room.id} className="section-stack profile-room-item">
                    <div className="profile-room-item__top">
                      <div className="section-stack section-stack--sm profile-room-item__copy">
                        <div className="toolbar-row profile-room-item__title-row">
                          <h3 className="profile-room-item__title">{room.name}</h3>
                          <Badge variant={room.visibility}>{room.visibility === 'public' ? 'Publica' : room.visibility === 'unlisted' ? 'Nao listada' : 'Pessoal'}</Badge>
                          <Badge variant={room.require_password_every_time ? 'warning' : 'info'}>
                            {room.require_password_every_time ? 'Senha sempre' : 'Acesso salvo'}
                          </Badge>
                          {room.is_archived ? <Badge variant="muted">Arquivada</Badge> : null}
                        </div>
                        {room.description ? <p className="text-muted">{room.description}</p> : null}
                        <p className="profile-room-item__meta">
                          {room.category} · #{room.id.slice(0, 6)} ·{' '}
                          {new Date(room.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <TimerPill minutes={room.message_ttl_minutes} />
                    </div>

                    {isEditing ? (
                      <div className="section-stack">
                        <Input
                          label="Nome da sala"
                          value={draft.name}
                          maxLength={48}
                          onChange={(event) =>
                            setRoomDrafts((current) => ({
                              ...current,
                              [room.id]: { ...draft, name: event.target.value },
                            }))
                          }
                        />

                        <Input
                          label="Descricao"
                          value={draft.description}
                          maxLength={120}
                          onChange={(event) =>
                            setRoomDrafts((current) => ({
                              ...current,
                              [room.id]: { ...draft, description: event.target.value },
                            }))
                          }
                        />

                        <div className="section-stack section-stack--sm">
                          <span className="ui-field__label">Categoria</span>
                          <div className="create-category-row">
                            {roomCategoryOptions.map((category) => (
                              <Chip
                                key={`${room.id}-${category}`}
                                selected={draft.category === category}
                                onClick={() =>
                                  setRoomDrafts((current) => ({
                                    ...current,
                                    [room.id]: { ...draft, category },
                                  }))
                                }
                              >
                                {category}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        <div className="section-stack section-stack--sm">
                          <span className="ui-field__label">Visibilidade</span>
                          <div className="create-category-row">
                            {ROOM_VISIBILITY_OPTIONS.map((visibility) => (
                              <Chip
                                key={`${room.id}-${visibility}`}
                                selected={draft.visibility === visibility}
                                onClick={() =>
                                  setRoomDrafts((current) => ({
                                    ...current,
                                    [room.id]: { ...draft, visibility },
                                  }))
                                }
                              >
                                {visibility === 'public' ? 'Publica' : visibility === 'unlisted' ? 'Nao listada' : 'Pessoal'}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        <div className="section-stack section-stack--sm">
                          <span className="ui-field__label">Timer</span>
                          <div className="create-category-row">
                            {ROOM_TTL_OPTIONS.map((ttl) => (
                              <Chip
                                key={`${room.id}-ttl-${ttl}`}
                                selected={draft.message_ttl_minutes === ttl}
                                onClick={() =>
                                  setRoomDrafts((current) => ({
                                    ...current,
                                    [room.id]: { ...draft, message_ttl_minutes: ttl },
                                  }))
                                }
                              >
                                {ttl} min
                              </Chip>
                            ))}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRoomDrafts((current) => ({
                              ...current,
                              [room.id]: { ...draft, is_archived: !draft.is_archived },
                            }))
                          }
                        >
                          {draft.is_archived ? 'Marcar como ativa' : 'Marcar como arquivada'}
                        </Button>

                        <div className="profile-room-item__actions">
                          <Button variant="ghost" size="sm" onClick={() => cancelRoomEdit(room)}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            loading={isBusy}
                            leadingIcon={!isBusy ? <Check size={15} /> : null}
                            onClick={() => void saveRoomChanges(room.id)}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="profile-room-item__actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Pencil size={15} />}
                          onClick={() => beginRoomEdit(room)}
                        >
                          Editar
                        </Button>
                        {room.visibility !== 'personal' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={<Copy size={15} />}
                            onClick={() => void copyInviteLink(room)}
                          >
                            Copiar convite
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Archive size={15} />}
                          loading={isBusy}
                          onClick={() => void toggleRoomArchive(room)}
                        >
                          {room.is_archived ? 'Restaurar' : 'Arquivar'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leadingIcon={<Trash2 size={15} />}
                          loading={isBusy}
                          onClick={() => void deleteRoom(room)}
                        >
                          Apagar
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
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

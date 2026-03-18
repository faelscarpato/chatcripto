import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Hash, Key, LogOut, Search, MessageSquarePlus, ChevronRight, User } from 'lucide-react';
import { deriveKey, getSalt } from '../lib/crypto';

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
}

const CATEGORIES = ['Geral', 'Tecnologia', 'Lazer', 'Trabalho', 'Privado', '+18'];

export default function RoomList({ onJoinRoom, onOpenProfile }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userProfile, setUserProfile] = useState<{ age_group: string } | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]); // IDs das salas já acessadas
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomKey, setNewRoomKey] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('Geral');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [requirePassEveryTime, setRequirePassEveryTime] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchRooms();
    fetchUserAccess();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('age_group').eq('id', user.id).single();
      if (data) setUserProfile(data);
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (data) setRooms(data);
  };

  const fetchUserAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('room_access').select('room_id').eq('user_id', user.id);
      if (data) setUserAccess(data.map(a => a.room_id));
    }
  };

  const registerAccess = async (roomId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('room_access').upsert({ user_id: user.id, room_id: roomId }, { onConflict: 'user_id, room_id' });
      setUserAccess(prev => [...new Set([...prev, roomId])]);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    const { data, error } = await supabase.from('rooms').insert([{ 
      name: newRoomName,
      age_group: userProfile.age_group,
      category: newRoomCategory,
      require_password_every_time: requirePassEveryTime
    }]).select().single();
    
    if (error) return alert(error.message);
    
    if (data) {
      const salt = getSalt(data.id);
      const key = await deriveKey(newRoomKey, salt);
      await registerAccess(data.id);
      
      // Salva a chave no SessionStorage para acesso rápido nesta sessão
      sessionStorage.setItem(`room_key_${data.id}`, newRoomKey);
      
      onJoinRoom({ id: data.id, name: data.name, key });
    }
  };

  const tryJoinDirectly = async (room: Room) => {
    const savedKey = sessionStorage.getItem(`room_key_${room.id}`);
    const hasAccess = userAccess.includes(room.id);

    if (hasAccess && !room.require_password_every_time && savedKey) {
      const salt = getSalt(room.id);
      const key = await deriveKey(savedKey, salt);
      onJoinRoom({ id: room.id, name: room.name, key });
    } else {
      setJoiningRoomId(room.id);
    }
  };

  const joinWithKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joiningRoomId) return;
    const room = rooms.find(r => r.id === joiningRoomId);
    if (!room) return;

    const salt = getSalt(room.id);
    const key = await deriveKey(inputKey, salt);
    
    // Testar se a chave está correta (opcional, mas aqui vamos assumir que sim e salvar)
    sessionStorage.setItem(`room_key_${room.id}`, inputKey);
    await registerAccess(room.id);
    
    onJoinRoom({ id: room.id, name: room.name, key });
  };

  const filteredRooms = rooms.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#0f172a]">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Secure<span className="text-indigo-500">Chat</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Painel de Controle</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onOpenProfile}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 border border-slate-700/50 transition-all"
            >
              <User size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold hidden sm:inline">Perfil</span>
            </button>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700/50 transition-all"
            >
              <span className="text-xs font-bold hidden sm:inline">Sair</span>
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8 pb-12 animate-slide-up">
        {/* Actions Bar */}
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['Todas', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 h-5 w-5" />
              <input 
                placeholder="Buscar sala pelo nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/40 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 text-white"
              />
            </div>
            <button 
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 shrink-0"
            >
              <MessageSquarePlus size={20} /> 
              <span>Nova Sala</span>
            </button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={createRoom} className="p-8 glass rounded-3xl border border-indigo-500/20 space-y-5 animate-in fade-in slide-in-from-top-6 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg"><Plus size={20}/></div>
              <h3 className="text-xl font-bold text-white">Criar Espaço Seguro</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1 uppercase">Nome Público</label>
                <input 
                  placeholder="Ex: Time de Devs"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                  className="w-full p-3.5 bg-slate-900/50 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1 uppercase">Chave de Criptografia</label>
                <input 
                  type="password"
                  placeholder="Sua senha secreta"
                  value={newRoomKey}
                  onChange={(e) => setNewRoomKey(e.target.value)}
                  required
                  className="w-full p-3.5 bg-slate-900/50 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1 uppercase">Categoria</label>
                <select 
                  value={newRoomCategory}
                  onChange={(e) => setNewRoomCategory(e.target.value)}
                  className="w-full p-3.5 bg-slate-900/50 rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                >
                  {CATEGORIES.filter(c => c !== '+18' || userProfile?.age_group === '+18').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input 
                  type="checkbox"
                  id="requirePass"
                  checked={requirePassEveryTime}
                  onChange={(e) => setRequirePassEveryTime(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="requirePass" className="text-xs font-bold text-slate-400 uppercase cursor-pointer">
                  Exigir senha em cada acesso
                </label>
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black uppercase tracking-wider transition-all text-white shadow-xl shadow-emerald-900/20 active:scale-[0.98]">
              Gerar Chave e Iniciar Sala
            </button>
          </form>
        )}

        {/* Room Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Hash size={16} className="text-indigo-500" /> Salas Disponíveis
            </h2>
            <span className="text-xs font-bold bg-slate-800/50 px-2.5 py-1 rounded-full text-slate-400 border border-slate-700/50">{filteredRooms.length}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredRooms.map(room => (
              <div key={room.id} className="group relative flex flex-col p-5 glass hover:bg-slate-800/40 border border-slate-700/50 hover:border-indigo-500/50 rounded-3xl transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-800 text-indigo-400 font-black text-lg border border-slate-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-500">
                      {room.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-lg group-hover:text-indigo-400 transition-colors">{room.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                          room.age_group === '+18' 
                            ? 'text-rose-400 border-rose-400/30 bg-rose-400/10' 
                            : 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                        }`}>
                          {room.age_group}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest font-mono">ID: {room.id.slice(0,8)}</p>
                    </div>
                  </div>
                  {!joiningRoomId || joiningRoomId !== room.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <button 
                        onClick={() => tryJoinDirectly(room)}
                        className={`p-2.5 rounded-xl transition-all ${
                          userAccess.includes(room.id) && !room.require_password_every_time
                            ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30'
                            : 'bg-slate-800/80 hover:bg-indigo-600 rounded-xl text-slate-400 hover:text-white border border-slate-700/50'
                        }`}
                        title={userAccess.includes(room.id) && !room.require_password_every_time ? "Entrada Direta Disponível" : "Entrar com Senha"}
                      >
                        <ChevronRight size={20} />
                      </button>
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{room.category}</span>
                    </div>
                  ) : null}
                </div>

                {joiningRoomId === room.id && (
                  <form onSubmit={joinWithKey} className="mt-6 p-4 bg-slate-900/50 rounded-2xl border border-indigo-500/30 animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col gap-3">
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input 
                          type="password"
                          placeholder="Senha de Acesso"
                          value={inputKey}
                          onChange={(e) => setInputKey(e.target.value)}
                          required
                          autoFocus
                          className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setJoiningRoomId(null)}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs text-slate-300"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs text-white shadow-lg shadow-indigo-900/20"
                        >
                          Entrar Agora
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-20 glass rounded-3xl border-dashed border-2 border-slate-800">
              <p className="text-slate-500 font-medium">Nenhuma sala encontrada com este nome.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

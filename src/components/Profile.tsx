import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, ArrowLeft, MapPin, Calendar, CreditCard, Type } from 'lucide-react';

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
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<Partial<ProfileData>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

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
    if (!birthDateString) return 'Livre';
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18 ? '+18' : 'Livre';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
      const age_group = calculateAgeGroup(formData.birth_date || '');
      
      const updates = {
        ...formData,
        age_group,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;
      
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
      <div className="flex h-screen items-center justify-center bg-[#0f172a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-800/50 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Meu Perfil</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-indigo-600 flex items-center justify-center text-4xl font-bold shadow-xl shadow-indigo-900/20">
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">{profile?.username}</h2>
              <p className="text-sm text-slate-400">
                {profile?.age_group === '+18' ? 'Maior de idade (+18)' : 'Menor de idade (Livre)'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Type size={14} /> Nome Completo
              </label>
              <input
                type="text"
                value={formData.full_name || ''}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                placeholder="Seu nome real"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <CreditCard size={14} /> CPF
                </label>
                <input
                  type="text"
                  value={formData.cpf || ''}
                  onChange={e => setFormData({...formData, cpf: e.target.value})}
                  className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Calendar size={14} /> Data de Nascimento
                </label>
                <input
                  type="date"
                  value={formData.birth_date || ''}
                  onChange={e => setFormData({...formData, birth_date: e.target.value})}
                  className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <MapPin size={14} /> Endereço
              </label>
              <textarea
                value={formData.address || ''}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all min-h-[100px]"
                placeholder="Seu endereço completo"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>Salavando...</>
                ) : (
                  <>
                    <Save size={20} /> Salvar Alterações
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}

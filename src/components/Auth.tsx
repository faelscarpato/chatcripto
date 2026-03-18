import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [ageGroup, setAgeGroup] = useState<'Livre' | '+18'>('Livre');
  
  // Novos campos de identidade
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { 
            age_group: ageGroup,
            full_name: fullName,
            cpf: cpf,
            birth_date: birthDate,
            address: address
          }
        }
      });
      if (error) alert(error.message);
      else alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden bg-[#0f172a]">
      {/* Abstract Background Decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-8 glass rounded-3xl shadow-2xl animate-slide-up relative z-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] mb-6 rotate-3">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            {isRegistering ? 'Crie sua conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-sm text-slate-400">
            Mensagens seguras que desaparecem em <span className="text-indigo-400 font-semibold">20 minutos</span>.
          </p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-5">
          <div className="space-y-4">
            <div className="group">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {isRegistering && (
              <>
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Seu nome real"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isRegistering}
                    className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">CPF</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      required={isRegistering}
                      className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required={isRegistering}
                      className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Endereço Completo</label>
                  <input
                    type="text"
                    placeholder="Rua, Número, Bairro, Cidade"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required={isRegistering}
                    className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                  />
                </div>
              </>
            )}

            <div className="group">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Grupo de Idade</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setAgeGroup('Livre')}
                  className={`flex-1 py-3 rounded-2xl border-2 transition-all ${
                    ageGroup === 'Livre' 
                      ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                  }`}
                >
                  Livre
                </button>
                <button
                  type="button"
                  onClick={() => setAgeGroup('+18')}
                  className={`flex-1 py-3 rounded-2xl border-2 transition-all ${
                    ageGroup === '+18' 
                      ? 'bg-rose-600/20 border-rose-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                  }`}
                >
                  +18
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative group flex items-center justify-center py-4 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all shadow-[0_10px_20px_-10px_rgba(79,70,229,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white overflow-hidden"
          >
            <div className="absolute inset-0 w-1/4 h-full bg-white/20 -skew-x-[30deg] -translate-x-full group-hover:translate-x-[400%] transition-transform duration-700 ease-in-out" />
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            <span className="relative z-10">{isRegistering ? 'Criar Conta' : 'Entrar Agora'}</span>
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-slate-700/50">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm font-medium text-slate-400 hover:text-indigo-400 transition-colors"
          >
            {isRegistering ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
            <span className="text-indigo-400 hover:underline">{isRegistering ? 'Entrar' : 'Registrar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

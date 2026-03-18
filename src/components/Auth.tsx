import { useState } from 'react';
import { CalendarDays, CreditCard, Mail, MapPin, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  HeroLogoBlock,
  Input,
  PasswordField,
  TimerPill,
} from './ui';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [ageGroup, setAgeGroup] = useState<'Livre' | '+18'>('Livre');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            age_group: ageGroup,
            full_name: fullName,
            cpf,
            birth_date: birthDate,
            address,
          },
        },
      });

      if (error) {
        alert(error.message);
      } else {
        alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="page-shell">
      <main className="auth-shell">
        <HeroLogoBlock
          eyebrow="Private neon messaging"
          title={
            <>
              Chat<span className="hero-logo__accent">Cripto</span>
            </>
          }
          subtitle="Mensagens privadas, mídia efêmera e identidade protegida em um fluxo mobile-first tokenizado."
          meta={
            <>
              <TimerPill label="Autodestruição em 20 min" />
              <Badge variant="info">AES-GCM ativo</Badge>
              <Badge variant="primary">Premium neon UI</Badge>
            </>
          }
        />

        <Card className="section-stack">
          <div className="toolbar-row">
            <Chip selected={!isRegistering} onClick={() => setIsRegistering(false)}>
              Entrar
            </Chip>
            <Chip selected={isRegistering} onClick={() => setIsRegistering(true)}>
              Registrar
            </Chip>
          </div>

          <div className="section-stack section-stack--sm">
            <h2 className="topbar__title">{isRegistering ? 'Criar identidade segura' : 'Retomar sessão protegida'}</h2>
            <p className="text-muted">
              {isRegistering
                ? 'Complete o cadastro para liberar salas privadas e filtros por faixa etária.'
                : 'Entre na sua conta para acessar salas com chave persistente e mensagens temporizadas.'}
            </p>
          </div>

          <form className="page-stack" onSubmit={handleAuth}>
            <Input
              label="E-mail"
              type="email"
              icon={<Mail size={18} />}
              placeholder="voce@chatcripto.app"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {isRegistering ? (
              <>
                <Input
                  label="Nome completo"
                  icon={<UserRound size={18} />}
                  placeholder="Seu nome real"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />

                <div className="auth-grid">
                  <Input
                    label="CPF"
                    icon={<CreditCard size={18} />}
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(event) => setCpf(event.target.value)}
                    required
                  />
                  <Input
                    label="Nascimento"
                    type="date"
                    icon={<CalendarDays size={18} />}
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Endereço"
                  icon={<MapPin size={18} />}
                  placeholder="Rua, número, bairro e cidade"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </>
            ) : null}

            <PasswordField
              label="Senha"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {isRegistering ? (
              <div className="section-stack section-stack--sm">
                <span className="ui-field__label">Grupo de idade</span>
                <div className="toolbar-row">
                  <Chip selected={ageGroup === 'Livre'} onClick={() => setAgeGroup('Livre')}>
                    Livre
                  </Chip>
                  <Chip selected={ageGroup === '+18'} onClick={() => setAgeGroup('+18')}>
                    +18
                  </Chip>
                </div>
              </div>
            ) : null}

            <Button
              type="submit"
              fullWidth
              loading={loading}
              leadingIcon={!loading ? <ShieldCheck size={18} /> : null}
            >
              {isRegistering ? 'Criar conta segura' : 'Entrar na sala privada'}
            </Button>
          </form>

          <Divider />

          <div className="section-stack section-stack--sm">
            <div className="toolbar-row">
              <p className="eyebrow">Social login UI</p>
              <Badge variant="warning">Em breve</Badge>
            </div>
            <div className="auth-socials">
              <Button variant="secondary" fullWidth disabled leadingIcon={<Mail size={18} />}>
                Continuar com e-mail corporativo
              </Button>
              <Button variant="ghost" fullWidth disabled leadingIcon={<Sparkles size={18} />}>
                Continuar com provedor social
              </Button>
            </div>
          </div>

          <button type="button" className="text-muted" onClick={() => setIsRegistering((current) => !current)}>
            {isRegistering ? 'Já possui conta? Entrar' : 'Ainda não possui conta? Registrar'}
          </button>
        </Card>
      </main>
    </div>
  );
}

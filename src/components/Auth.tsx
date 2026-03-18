import { useState } from 'react';
import { CalendarDays, CreditCard, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Card, Chip, Divider, Input, PasswordField } from './ui';

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
      <main className="auth-shell auth-shell--compact">
        <section className="auth-stage">
          <div className="auth-brand">
            <div className="auth-brand__mark" aria-hidden="true">
              <div className="auth-brand__halo" />
              <img src="/chatcripto-logo.png" alt="" className="auth-brand__logo" />
            </div>
            
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Autenticação">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegistering}
              className={`auth-tab ${!isRegistering ? 'auth-tab--active' : ''}`}
              onClick={() => setIsRegistering(false)}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegistering}
              className={`auth-tab ${isRegistering ? 'auth-tab--active' : ''}`}
              onClick={() => setIsRegistering(true)}
            >
              Registrar
            </button>
          </div>

          <Card className="auth-card">
            <form className="page-stack auth-form" onSubmit={handleAuth}>
              <Input
                label={isRegistering ? 'E-mail' : undefined}
                type="email"
                icon={<Mail size={18} />}
                placeholder="Email ou usuario"
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
                    label="Endereco"
                    icon={<MapPin size={18} />}
                    placeholder="Rua, numero, bairro e cidade"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                  />
                </>
              ) : null}

              <PasswordField
                label={isRegistering ? 'Senha' : undefined}
                placeholder="Senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                toggleMode={!isRegistering ? 'text' : 'icon'}
                required
              />

              {!isRegistering ? (
                <button type="button" className="auth-link auth-link--muted">
                  Esqueceu sua senha?
                </button>
              ) : null}

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
                className="auth-submit"
                leadingIcon={!loading && isRegistering ? <LockKeyhole size={18} /> : null}
              >
                {isRegistering ? 'Criar conta' : 'Entrar'}
              </Button>
            </form>

            <Divider />

            <div className="auth-separator">
              <span>OU</span>
            </div>

            <div className="auth-socials auth-socials--compact">
              <button type="button" className="auth-social auth-social--google" disabled aria-label="Google">
                <span>G</span>
              </button>
              <button type="button" className="auth-social auth-social--facebook" disabled aria-label="Facebook">
                <span>f</span>
              </button>
            </div>

            <button type="button" className="auth-link" onClick={() => setIsRegistering((current) => !current)}>
              {isRegistering ? (
                <>
                  Ja tem conta? <span className="auth-link__accent">Entrar</span>
                </>
              ) : (
                <>
                  Ainda nao tem conta? <span className="auth-link__accent">Registre-se</span>
                </>
              )}
            </button>
          </Card>
        </section>
      </main>
    </div>
  );
}

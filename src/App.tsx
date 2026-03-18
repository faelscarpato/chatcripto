import { useEffect, useState } from 'react';
import { type User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Chat from './components/Chat';
import CreateRoom from './components/CreateRoom';
import Profile from './components/Profile';
import RoomList from './components/RoomList';
import { HeroLogoBlock, TimerPill } from './components/ui';
import { supabase } from './lib/supabase';

type AppScreen = 'home' | 'create' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string; key: CryptoKey } | null>(null);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="page-shell">
        <main className="page-container">
          <HeroLogoBlock
            eyebrow="Inicializando sessão"
            title={
              <>
                Chat<span className="hero-logo__accent">Cripto</span>
              </>
            }
            subtitle="Carregando autenticação e preparando o shell seguro antes de liberar o app."
            meta={<TimerPill label="20 min efêmeros" />}
          />
        </main>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (currentRoom) {
    return (
      <Chat
        room={currentRoom}
        onLeave={() => {
          setCurrentRoom(null);
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'create') {
    return (
      <CreateRoom
        onJoinRoom={(room) => setCurrentRoom(room)}
        onNavigateHome={() => setScreen('home')}
        onNavigateProfile={() => setScreen('profile')}
      />
    );
  }

  if (screen === 'profile') {
    return (
      <Profile
        onNavigateHome={() => setScreen('home')}
        onNavigateCreate={() => setScreen('create')}
      />
    );
  }

  return (
    <RoomList
      onJoinRoom={(room) => setCurrentRoom(room)}
      onOpenProfile={() => setScreen('profile')}
      onOpenCreate={() => setScreen('create')}
    />
  );
}

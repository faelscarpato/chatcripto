import { useEffect, useState } from 'react';
import { type User } from '@supabase/supabase-js';
import Auth from './components/Auth';
import Chat from './components/Chat';
import CreateRoom from './components/CreateRoom';
import Profile from './components/Profile';
import RoomList from './components/RoomList';
import { SplashScreen } from './components/ui';
import { supabase } from './lib/supabase';

type AppScreen = 'home' | 'create' | 'profile';

function getInviteRoomId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{
    id: string;
    name: string;
    key: CryptoKey;
    requirePasswordEveryTime?: boolean;
  } | null>(null);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [loading, setLoading] = useState(true);
  const [invitedRoomId, setInvitedRoomId] = useState<string | null>(() => getInviteRoomId());

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      new Promise((resolve) => window.setTimeout(resolve, 650)),
    ]).then(([{ data: { session } }]) => {
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
    return <SplashScreen />;
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
      invitedRoomId={invitedRoomId}
      onInviteHandled={() => setInvitedRoomId(null)}
    />
  );
}

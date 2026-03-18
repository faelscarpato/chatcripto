import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import RoomList from './components/RoomList';
import Chat from './components/Chat';
import Profile from './components/Profile';
import { type User } from '@supabase/supabase-js';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string; key: CryptoKey } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">Loading...</div>;

  if (!user) return <Auth />;

  if (currentRoom) {
    return (
      <Chat 
        room={currentRoom} 
        onLeave={() => setCurrentRoom(null)} 
      />
    );
  }

  if (showProfile) {
    return <Profile onBack={() => setShowProfile(false)} />;
  }

  return (
    <div className="h-screen flex flex-col">
      <RoomList 
        onJoinRoom={(room) => setCurrentRoom(room)} 
        onOpenProfile={() => setShowProfile(true)}
      />
    </div>
  );
}

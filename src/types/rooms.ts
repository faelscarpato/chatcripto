export type RoomVisibility = 'public' | 'unlisted' | 'personal';
export type RoomTtlMinutes = 5 | 10 | 15 | 20;
export type RoomRole = 'owner' | 'member';

export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  age_group: 'Livre' | '+18';
  category: string;
  visibility: RoomVisibility;
  message_ttl_minutes: RoomTtlMinutes;
  require_password_every_time: boolean;
  password_verifier: string | null;
  created_by: string | null;
  is_archived: boolean;
  last_activity_at: string;
  created_at: string;
}

export interface RoomAccessEntry {
  room_id: string;
  role: RoomRole;
  is_favorite: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface ActiveRoom {
  id: string;
  name: string;
  key: CryptoKey;
  requirePasswordEveryTime?: boolean;
  visibility: RoomVisibility;
  messageTtlMinutes: RoomTtlMinutes;
  createdBy?: string | null;
  description?: string | null;
  category?: string | null;
}

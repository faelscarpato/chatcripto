export const DEFAULT_PROFILE_EMOJI = '🙂';

export const PROFILE_EMOJI_OPTIONS = [
  '🙂',
  '😎',
  '🤖',
  '🦊',
  '🐼',
  '🐙',
  '🦄',
  '🐯',
  '🐸',
  '🐧',
  '🦉',
  '🐻',
  '🌙',
  '⭐',
  '🔥',
  '⚡',
  '🎯',
  '🎧',
  '🛰️',
  '🔒',
] as const;

export function normalizeProfileEmoji(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_PROFILE_EMOJI;
  }

  return PROFILE_EMOJI_OPTIONS.includes(value as (typeof PROFILE_EMOJI_OPTIONS)[number])
    ? value
    : DEFAULT_PROFILE_EMOJI;
}

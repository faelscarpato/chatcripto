import type { RoomVisibility } from '../types/rooms';

export function buildRoomInviteUrl(roomId: string) {
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
}

export function buildRoomInviteText(options: {
  roomName: string;
  roomId: string;
  visibility?: RoomVisibility;
  requirePasswordEveryTime?: boolean;
}) {
  if (options.visibility === 'personal') {
    return `A sala ${options.roomName} esta marcada como pessoal e nao pode ser compartilhada.`;
  }

  const inviteUrl = buildRoomInviteUrl(options.roomId);
  const visibilityLabel = options.visibility === 'unlisted' ? 'Sala nao listada' : 'Sala publica';

  if (options.requirePasswordEveryTime) {
    return `Convite para a sala ${options.roomName}: ${inviteUrl}\n${visibilityLabel}. Envie a senha da sala separadamente.`;
  }

  return `Convite para a sala ${options.roomName}: ${inviteUrl}\n${visibilityLabel}. Se a sala solicitar senha no primeiro acesso, envie a senha separadamente.`;
}

export async function shareRoomInvite(options: {
  roomName: string;
  roomId: string;
  visibility?: RoomVisibility;
  requirePasswordEveryTime?: boolean;
}) {
  if (options.visibility === 'personal') {
    throw new Error('Salas pessoais nao aceitam convite.');
  }

  const inviteUrl = buildRoomInviteUrl(options.roomId);
  const shareText = buildRoomInviteText(options);

  if (navigator.share) {
    await navigator.share({
      title: `Convite ChatCripto: ${options.roomName}`,
      text: shareText,
      url: inviteUrl,
    });
    return 'shared';
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareText);
    return 'copied';
  }

  window.prompt('Copie o convite abaixo:', shareText);
  return 'prompt';
}

export async function copyRoomInvite(options: {
  roomId: string;
  visibility?: RoomVisibility;
  requirePasswordEveryTime?: boolean;
  password?: string;
}) {
  if (options.visibility === 'personal') {
    throw new Error('Salas pessoais nao aceitam convite.');
  }

  const inviteUrl = buildRoomInviteUrl(options.roomId);
  const inviteText =
    options.requirePasswordEveryTime && options.password
      ? `${inviteUrl}\nSenha da sala: ${options.password}`
      : options.requirePasswordEveryTime
        ? `${inviteUrl}\nSenha da sala: envie separadamente ao convidado.`
        : inviteUrl;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(inviteText);
    return 'copied';
  }

  window.prompt('Copie o convite abaixo:', inviteText);
  return 'prompt';
}

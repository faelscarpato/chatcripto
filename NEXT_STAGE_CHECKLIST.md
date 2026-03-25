# Next Stage Checklist

## 1) SQL hardening rollout

- [ ] Revisar e aplicar `supabase/hardening_security_and_settings_migration.sql` em ambiente de staging.
- [ ] Validar RPC `get_room_invite_snapshot(room_id)` com usuário autenticado e por faixa etária.
- [ ] Validar RPC `join_room_with_password(room_id, password)` para:
  - [ ] senha correta
  - [ ] senha incorreta
  - [ ] sala pessoal de terceiro
  - [ ] mismatch de age group
- [ ] Confirmar que leitura/escrita em `messages` só funciona para membros da sala.
- [ ] Confirmar que `storage.objects` do bucket `ephemeral-media` só funciona para membros da sala.
- [ ] Confirmar bloqueio de `room_access` por INSERT direto (não-owner).

## 2) Ajustes de frontend obrigatórios para compatibilidade com hardening

- [ ] Trocar fluxo de convite em `RoomList.tsx`:
  - [ ] substituir `fetchRoomById` via SELECT direto por chamada RPC `get_room_invite_snapshot`.
- [ ] Trocar entrada em sala por senha:
  - [ ] substituir `registerAccess/upsert` direto por RPC `join_room_with_password`.
- [ ] Após RPC de join com sucesso, abrir sala normalmente (derivação de chave continua local).
- [ ] Garantir tratamento de erros por `reason` da RPC (ex.: `invalid_password`, `age_group_mismatch`).

## 3) Telas faltantes do roadmap (MVP funcional)

### 3.1 Age Verification (`age_verification`)
- [ ] Criar tela/fluxo dedicado em `App.tsx` (novo `screen`).
- [ ] Exibir status atual consultando `age_verification_requests`.
- [ ] Permitir envio de nova solicitação (`status=pending`, `requested_age_group`).
- [ ] Mostrar estados: pendente, aprovado, rejeitado, needs_review.

### 3.2 Security Settings (`security_settings`)
- [ ] Criar tela de configurações de segurança.
- [ ] Persistir em `user_settings`:
  - [ ] `biometric_lock_enabled`
  - [ ] `panic_wipe_enabled`
  - [ ] `notifications_enabled`
- [ ] Mostrar “integrity status” com dados reais (não mock).

### 3.3 Chat Settings (`chat_settings_list_view`, `chat_settings_card_layout`, `chat_settings_timer_focus`)
- [ ] Criar tela única com 3 seções (List, Card, Timer focus) ou tabs.
- [ ] Persistir em `user_settings`:
  - [ ] `privacy_blur_media`
  - [ ] `enforce_view_once`
  - [ ] `global_message_ttl_minutes` (fallback para criação de novas salas)
- [ ] Integrar com `CreateRoom` como valor inicial de timer.

## 4) Consistência de UI global

- [ ] Padronizar idioma da UI (PT-BR completo ou EN completo).
- [ ] Corrigir `SplashScreen` com título de marca visível.
- [ ] Consolidar tema (`tokens.css` + `vault.css`) para evitar drift.
- [ ] Revisar bottom nav e headers para hierarquia visual uniforme entre todas as telas.

## 5) Definição de pronto (DoD)

- [ ] `npm run build` sem erros.
- [ ] `npm run lint` sem erros (warnings aceitáveis apenas se justificados).
- [ ] Teste manual de 2 usuários em faixas etárias diferentes.
- [ ] Teste manual de sala `public`, `unlisted`, `personal`.
- [ ] Teste de upload/download/delete de mídia efêmera com RLS endurecido.

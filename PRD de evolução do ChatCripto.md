Fechado. Aqui vai o pacote que faltava: **PRD enxuto + checklist técnico por arquivo + ordem de execução** já moldado para o seu projeto.

---

# PRD de evolução do ChatCripto

## Nome da iniciativa

**ChatCripto 2.0: Minhas Salas + Comunidade + Efemeridade por Sala**

## Objetivo

Evoluir o produto de uma lista simples de salas para uma experiência com:

* organização pessoal
* descoberta de comunidade
* privacidade real por tipo de sala
* timers configuráveis por sala
* home com mais valor percebido
* arquitetura coerente entre UI, backend e segurança

## Problemas atuais

Com base na estrutura atual do projeto:

* `RoomList.tsx` ainda trabalha como lista única
* `CreateRoom.tsx` mostra 20 min fixos
* `Chat.tsx` usa `MESSAGE_TTL_MS` fixo em código
* `schema.sql` ainda governa efemeridade com trigger baseada em insert
* `room_access` existe, mas ainda é simples demais para virar “Minhas salas”
* a home atual não separa uso pessoal de descoberta pública

## O que será entregue

### Produto

* seção **Minhas salas**
* seção **Comunidade**
* tipos de sala:

  * `public`
  * `unlisted`
  * `personal`
* timer por sala:

  * 5
  * 10
  * 15
  * 20 min
* owner com edição de sala
* favoritos e recentes
* sistema de expiração mais robusto

### Técnico

* novas migrations
* RLS ajustado
* novo fluxo de listagem
* topbar de chat com contexto da sala
* system messages
* cleanup por `expires_at`

---

# Escopo funcional

## 1. Minhas salas

### Deve incluir

* salas criadas por mim
* salas em que entrei
* favoritas
* recentes

### Não deve incluir agora

* pastas de organização
* pin manual em várias ordens
* moderação avançada por owner

---

## 2. Comunidade

### Deve incluir

* apenas salas `public`
* busca
* filtros simples
* cards com badges de timer, categoria e visibilidade

### Não deve incluir agora

* ranking complexo
* feed social
* recomendação algorítmica

---

## 3. Visibilidade das salas

### `public`

* aparece na comunidade
* qualquer usuário elegível pode descobrir
* pode ter senha

### `unlisted`

* não aparece na comunidade
* entra por link, código ou senha
* criador e membros autorizados conseguem acessar

### `personal`

* só o criador vê
* não aparece para comunidade nem para outros membros

---

## 4. Efemeridade

### Regras

* cada sala tem `message_ttl_minutes`
* cada mensagem recebe `expires_at`
* UI mostra o timer ativo da sala
* mensagens de sistema aparecem quando regra muda
* mídia “view once” continua com comportamento especial

---

## 5. Edição da sala

Owner poderá:

* editar nome
* editar descrição
* alterar visibilidade
* alterar timer
* arquivar sala
* copiar convite

---

# Critérios de sucesso

## Produto

* home fica mais clara
* usuário entende diferença entre espaço pessoal e comunidade
* timer configurável não confunde
* privacidade é coerente

## Técnico

* sem timer hardcoded no chat
* sem depender apenas de trigger em insert para cleanup
* RLS não expõe salas indevidas
* fluxo de criação continua simples

---

# Ordem de implementação

## Bloco 1. Banco + segurança

1. nova migration de `rooms`
2. nova migration de `room_access`
3. nova migration de `messages`
4. ajustar RLS
5. cleanup com `expires_at`

## Bloco 2. Create Room

6. adicionar visibilidade
7. adicionar timer por sala
8. registrar owner corretamente

## Bloco 3. Chat

9. ler timer da sala
10. gerar `expires_at`
11. mostrar timer e visibilidade no topo
12. system messages

## Bloco 4. Home

13. refatorar `RoomList`
14. separar “Minhas salas” e “Comunidade”
15. favoritos/recentes
16. entrada por convite/código

## Bloco 5. Polimento

17. edição de sala
18. empty states
19. melhorias finas visuais
20. testes manuais principais

---

# Checklist técnico por arquivo

## `supabase/schema.sql`

### Modificar

Consolidar estrutura final para refletir o novo produto.

### Adicionar em `rooms`

* `description text`
* `visibility text check in ('public','unlisted','personal') default 'public'`
* `message_ttl_minutes integer check in (5,10,15,20) default 20`
* `is_archived boolean default false`
* `last_activity_at timestamptz default now()`

### Adicionar em `room_access`

* `role text check in ('owner','member') default 'member'`
* `is_favorite boolean default false`
* `last_seen_at timestamptz default now()`

### Adicionar em `messages`

* `expires_at timestamptz`
* opcional depois: `message_type`, `metadata`

### Remover dependência conceitual de

* trigger única `delete_old_messages()` baseada em `created_at < now() - interval '20 minutes'`

### Substituir por

* função que apaga por `expires_at`
* job programado

---

## `supabase/rooms_and_access_evolution.sql`

### Revisar

Esse arquivo já abriu caminho para `category`, `require_password_every_time` e `room_access`.

### Ajustar

* não sobrescrever a lógica já existente
* complementar com:

  * `role`
  * `is_favorite`
  * `last_seen_at`

### Validar

* `UNIQUE(user_id, room_id)` deve continuar

---

## nova migration sugerida

### `supabase/rooms_visibility_ttl_migration.sql`

### Criar

Este deve ser o coração da nova fase.

### Incluir

* alter table `rooms`
* update dados antigos com defaults
* checks de integridade
* índices úteis:

  * `rooms(created_by)`
  * `rooms(visibility, created_at desc)`
  * `rooms(last_activity_at desc)`
  * `room_access(user_id, last_seen_at desc)`
  * `messages(room_id, expires_at)`

---

## nova migration sugerida

### `supabase/message_expiration_cron_migration.sql`

### Criar

### Incluir

* função `delete_expired_messages()`
* `pg_cron` schedule
* limpeza de objetos de storage expirados, se viável na sua arquitetura
* comentário de manutenção

---

## `src/components/CreateRoom.tsx`

### Hoje

Já tem:

* nome
* descrição local
* categoria
* senha
* `require_password_every_time`

### Modificar

Adicionar estados:

* `newRoomVisibility`
* `messageTtlMinutes`

### Criar blocos visuais

* seção de visibilidade
* seção de timer
* explicação curta por tipo de sala

### Ajustar submit

Inserir em `rooms`:

* `description`
* `visibility`
* `message_ttl_minutes`
* `last_activity_at`
* `created_by`

### Ajustar `registerAccess`

Salvar owner:

* `role = 'owner'`

### Melhorar UX

* mostrar preview resumido:

  * pública / não listada / pessoal
  * expira em X min
  * exige senha / não

---

## `src/components/RoomList.tsx`

### Hoje

* busca simples
* filtro simples
* lista única
* usa `room_access` apenas para reentrada

### Refatorar

Separar em queries lógicas:

#### Query 1. minhas salas

salas onde:

* `created_by = currentUser`
* ou existe `room_access` para o usuário

#### Query 2. comunidade

salas:

* `visibility = 'public'`
* `is_archived = false`

### Criar seções visuais

* `Minhas salas`
* `Comunidade`

### Dentro de Minhas salas

* recentes
* criadas por mim
* favoritas

### Dentro de Comunidade

* em alta
* novas
* categorias

### Ajustar tipos

A interface `Room` precisa ganhar:

* `description`
* `visibility`
* `message_ttl_minutes`
* `is_archived`
* `last_activity_at`
* talvez `created_by`

### Ajustar filtros

Substituir filtros atuais por algo mais coerente:

* Todas
* Minhas
* Comunidade
* +18
* Favoritas
* Não listadas talvez só em Minhas

### Adicionar

* CTA “Entrar por código”
* empty state para cada seção

---

## `src/components/Chat.tsx`

### Hoje

Ponto crítico:

```ts
const MESSAGE_TTL_MS = 20 * 60 * 1000;
```

Isso precisa morrer sem funeral.

### Modificar props de `room`

Adicionar:

* `visibility`
* `messageTtlMinutes`
* `createdBy?`

### Substituir

* `MESSAGE_TTL_MS` fixo
  por:
* `room.messageTtlMinutes * 60 * 1000`

### No envio de mensagem

Salvar:

* `expires_at = now + ttl da sala`

### Na leitura

* usar `expires_at` para prune local
* continuar ouvindo delete realtime do Supabase

### Topbar

Adicionar visualmente:

* nome da sala
* badge de visibilidade
* timer pill

### Composer

Adicionar hint:

* “Mensagens expiram em 10 min”

### System messages

Criar modelo simples para eventos:

* mudança de timer
* mudança de visibilidade

Pode começar como mensagens especiais no mesmo feed, sem inventar engine complexa.

### Atualizar `last_activity_at`

Sempre que enviar mensagem:

* atualizar sala

---

## `src/components/ui/RoomCard.tsx`

### Modificar

Suportar novas props:

* `visibility`
* `messageTtlMinutes`
* `isFavorite`
* `isOwner`
* `description`

### Visual

Mostrar:

* badge de visibilidade
* timer pill
* categoria
* membros
* selo “minha sala” ou “owner”

---

## `src/components/ui/TimerPill.tsx`

### Verificar reaproveitamento

Você já tem um componente com nome perfeito.

### Ajustar

Permitir props do tipo:

* `minutes`
* `variant?: subtle | strong`

### Uso

* `RoomCard`
* `Chat topbar`
* talvez `CreateRoom`

---

## `src/components/ui/Badge.tsx`

### Expandir

Adicionar variantes:

* `public`
* `unlisted`
* `personal`
* `owner`
* `favorite`

---

## `src/components/ui/Topbar.tsx`

### Ajustar

Abrir espaço para:

* subtítulo
* grupo de badges
* ações de sala

---

## `src/components/ui/SearchBarPill.tsx`

### Reaproveitar

Na home nova, usar para:

* busca geral da comunidade
* busca das minhas salas

---

## `src/components/ui/Chip.tsx`

### Reaproveitar

Perfeito para:

* filtros
* timer options
* categorias

---

## `src/components/ui/PrivacyCardOption.tsx` e `RadioCard.tsx`

### Aproveitar

Use para a seleção de visibilidade da sala.

### Aplicar em `CreateRoom`

* Pública
* Não listada
* Pessoal

---

## `src/components/ui/BottomNav.tsx`

### Talvez só manter

A navegação já serve.
Só revisar destaque de estado ativo na home reformulada.

---

## `src/lib/crypto.ts`

### Não precisa grande mudança

A lógica de chave/senha continua útil.

### Apenas revisar

* qualquer derivação ou validação que assuma comportamento antigo
* manter `password_verifier` por sala

---

## `src/lib/share.ts`

### Modificar

Adicionar suporte mais explícito para convite de sala:

* link de convite
* talvez código curto depois

### No curto prazo

Manter URL com `roomId`
e usar isso no fluxo de `unlisted`

---

## `src/App.tsx`

### Ajustar navegação/estado global

Provável necessidade de passar no estado da sala:

* `visibility`
* `messageTtlMinutes`

### Verificar

* fluxo de entrada via invite
* fluxo de retorno da sala para home
* transições entre telas

---

# Modelo de dados recomendado

## `rooms`

```ts
type Room = {
  id: string;
  name: string;
  description: string | null;
  age_group: 'Livre' | '+18';
  category: string;
  visibility: 'public' | 'unlisted' | 'personal';
  message_ttl_minutes: 5 | 10 | 15 | 20;
  require_password_every_time: boolean;
  password_verifier: string | null;
  created_by: string;
  is_archived: boolean;
  last_activity_at: string;
  created_at: string;
}
```

## `room_access`

```ts
type RoomAccess = {
  id: string;
  user_id: string;
  room_id: string;
  role: 'owner' | 'member';
  is_favorite: boolean;
  last_seen_at: string;
  created_at: string;
}
```

## `messages`

```ts
type Message = {
  id: string;
  room_id: string;
  user_id: string;
  encrypted_content: string;
  iv: string;
  expires_at: string;
  created_at: string;
  is_view_once?: boolean;
  media_id?: string | null;
  media_type?: string | null;
  media_view_mode?: 'once' | '30s' | null;
  media_view_seconds?: number | null;
}
```

---

# Fluxos principais

## Fluxo 1. Criar sala

1. usuário abre criar sala
2. escolhe nome, categoria, descrição
3. escolhe visibilidade
4. escolhe timer
5. define senha
6. cria sala
7. `room_access` registra owner
8. entra direto na sala

## Fluxo 2. Home

1. abre home
2. vê “Minhas salas”
3. vê “Comunidade”
4. busca ou entra por convite

## Fluxo 3. Enviar mensagem

1. envia texto
2. app calcula `expires_at`
3. insere mensagem
4. atualiza `last_activity_at` da sala
5. realtime propaga
6. cleanup apaga quando expirar

## Fluxo 4. Entrar em sala não listada

1. usuário recebe link
2. abre app
3. valida senha se necessário
4. cria `room_access`
5. sala passa a aparecer em “Minhas salas”

---

# MVP exato da home nova

## Estrutura

### Header

* logo
* busca
* botão criar
* botão filtro

### Bloco 1

**Minhas salas**

* recentes
* favoritas
* criadas por mim

### Bloco 2

**Comunidade**

* novas
* em alta
* categorias

### Bloco 3

**Entrar por convite**

* colar link ou código

---

# Débitos técnicos que você pode aceitar por agora

Pode deixar para depois:

* analytics avançado
* recomendação de salas
* roles além de owner/member
* moderação sofisticada
* convites com expiração
* sistema de denúncia detalhado

---

# Prompt complementar para o Codex CLI, agora em modo execução por arquivos

```text
Implemente esta evolução em etapas pequenas e seguras, respeitando a arquitetura atual do projeto.

## Ordem obrigatória
1. Criar migrations novas em supabase para rooms, room_access e messages
2. Ajustar RLS e cleanup por expires_at
3. Refatorar CreateRoom.tsx
4. Refatorar Chat.tsx para usar message_ttl_minutes da sala
5. Refatorar RoomList.tsx para separar Minhas Salas e Comunidade
6. Atualizar componentes de UI reaproveitando os existentes
7. Ajustar App.tsx e tipos compartilhados

## Regras de implementação
- Não remover funcionalidades existentes sem substituir por equivalente melhor
- Não deixar timer hardcoded em 20 min no front
- Não usar privacidade apenas por ocultação visual
- Reaproveitar TimerPill, Badge, Chip, RadioCard e RoomCard
- Criar código limpo e incremental
- Mostrar arquivos alterados ao final
- Explicar as decisões críticas em poucas linhas

## Mudanças esperadas por arquivo
- supabase/schema.sql: consolidar estrutura final
- supabase/*.sql: criar migrations novas
- src/components/CreateRoom.tsx: visibilidade + TTL + owner access
- src/components/Chat.tsx: TTL por sala + expires_at + topbar contextual
- src/components/RoomList.tsx: Minhas Salas + Comunidade + favoritos/recentes
- src/components/ui/RoomCard.tsx: badges extras e metadados novos
- src/components/ui/TimerPill.tsx: aceitar minutos dinâmicos
- src/components/ui/Badge.tsx: novas variantes
- src/App.tsx: garantir passagem dos novos dados da sala

## Entrega
- implementar
- listar arquivos alterados
- resumir o que foi criado
- apontar eventuais TODOs residuais
```

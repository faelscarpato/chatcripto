# UI System Handoff

## Foundations

- Tokens centrais: [src/styles/tokens.css](/C:/Users/faels/Downloads/secure-chat-pwa/src/styles/tokens.css)
- Base visual dos componentes: [src/styles/ui.css](/C:/Users/faels/Downloads/secure-chat-pwa/src/styles/ui.css)

## Componentes alinhados

- `Button`: primary / secondary / danger / ghost
- `Input`: label, hint, error, icon, trailing
- `Badge`: muted / success / danger / warning / info / primary
- `Chip`: filtro / segmented lightweight
- `RadioCard`: seleção binária com ícone, descrição e indicador
- `Topbar`
- `Composer`
- `MessageBubble`
- `RoomCard`

## Regras visuais aplicadas

- Fundo escuro semântico com superfícies por opacidade
- Glow reduzido e reservado para `focus`/seleção
- CTA primário usando gradiente de marca
- Cards, chips e badges com borda semântica e contraste mais controlado
- Chat bubble simplificado, sem gradientes pesados

## Uso atual na aplicação

- `CreateRoom` já usa `RadioCard` para `Sala privada` / `Sala pública`
- `RoomList` usa `Chip` e `RoomCard`
- `Chat` usa `Topbar`, `Composer`, `MessageBubble`
- `Auth` ainda pode receber uma rodada extra para virar segmented/radio spec mais estrita

## Próxima rodada sugerida

- Substituir padrões legados de `PrivacyCardOption` pelos novos `RadioCard`
- Revisar `Auth` e `Profile` para aderência visual total
- Criar variantes documentadas por tamanho (`sm`, `md`, `lg`) no Figma

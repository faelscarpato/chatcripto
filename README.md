

# 🛡️ ChatCripto PWA — Cyber-Minimalist Secure Messaging

O **ChatCripto** é uma Progressive Web App (PWA) de chat em tempo real projetada com uma mentalidade de "Segurança por Design". Ele redefine a privacidade digital ao combinar criptografia de ponta-a-ponta (E2EE) no lado do cliente com uma arquitetura efêmera e moderação preventiva baseada em faixas etárias.

-----

## 💎 Diferenciais Estratégicos

### 🔐 Criptografia Militar End-to-End (E2EE)

Diferente de chats convencionais, o **Supabase nunca lê suas mensagens**.

  * **Derivação de Chave:** Utilizamos PBKDF2 com 100.000 iterações para derivar chaves AES-GCM de 256 bits a partir da senha da sala.
  * **Zero-Knowledge:** O servidor armazena apenas o `encrypted_content` e o `iv` (vetor de inicialização). O texto claro nunca deixa o seu navegador.

### ⏳ Privacidade Efêmera e Dinâmica

O projeto foi concebido para não deixar rastros.

  * **Auto-Cleanup (Trigger):** Um trigger PostgreSQL apaga mensagens comuns após 20 minutos de forma automática a cada novo envio.
  * **Mídia View-Once:** Implementação de visualização única para fotos. Uma vez visualizadas e fechadas, os dados são removidos da RAM e o registro é invalidado no storage.

### 🛡️ Arquitetura de Moderação Preventiva

  * **Segregação Etária via RLS:** O acesso às salas é controlado por Row Level Security (RLS) no banco de dados. Um usuário de uma faixa etária (ex: "Livre") é tecnicamente incapaz de visualizar ou injetar mensagens em salas de outra faixa (ex: "+18").
  * **Identidade Blindada:** O fluxo de registro captura metadados essenciais (CPF, data de nascimento) para garantir a integridade da comunidade.

-----

## 🚀 Setup do Ecossistema

### 1\. Infraestrutura Supabase

1.  Crie um projeto no [Supabase](https://supabase.com).
2.  **Schema SQL:** No SQL Editor, execute o arquivo `supabase/schema.sql` para configurar as tabelas `profiles`, `rooms`, `messages` e as políticas de segurança.
3.  **Credenciais:** Obtenha sua `URL` e `anon key` em *Project Settings -\> API*.

### 2\. Configuração de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 3\. Execução Local

```bash
# Instalação de dependências (React 19+, Lucide, Tailwind)
npm install

# Iniciar servidor de desenvolvimento (Vite)
npm run dev
```

-----

## 📦 Produção e Deployment

O ChatCript é um PWA completo, configurado para alta performance e suporte offline via `vite-plugin-pwa`.

```bash
# Compilação e otimização de assets
npm run build
```

**Hospedagem Recomendada:**

  * **Frontend:** Vercel ou Netlify (Suporte nativo a SPA/PWA).
  * **Backend:** Supabase (Database, Auth e Storage).

-----

## 🛠️ Stack Tecnológica

  * **Frontend:** React 19 (Hooks/Context).
  * **Estilização:** Tailwind CSS 4.0 (Arquitetura baseada em tokens).
  * **Backend as a Service:** Supabase (PostgreSQL + RLS + Triggers).
  * **Segurança:** Web Crypto API (AES-GCM, PBKDF2).
  * **PWA:** Service Workers para modo offline e instalação nativa.

-----

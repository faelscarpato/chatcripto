# Secure Chat PWA

## Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com).
2. Vá em **SQL Editor** e execute o conteúdo de `supabase/schema.sql`.
3. Vá em **Project Settings** -> **API** e copie a `URL` e a `anon key`.
4. Crie um arquivo `.env.local` na raiz do projeto com essas chaves:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```

## Funcionalidades de Segurança

- **Criptografia de Ponta-a-Ponta:** As mensagens são cifradas no navegador usando a chave da sala (AES-GCM). O Supabase nunca vê o conteúdo em texto claro.
- **Efemeridade:** Um Trigger no banco de dados apaga mensagens com mais de 20 minutos automaticamente a cada novo envio.
- **PWA:** Instalável no Android, Windows e iOS. Suporta modo offline para o shell do app.

## Como rodar

```bash
npm install
npm run dev
```

## Como gerar o PWA para produção

```bash
npm run build
```
Os arquivos estarão na pasta `dist`, prontos para serem hospedados (ex: Vercel, Netlify, Supabase Hosting).

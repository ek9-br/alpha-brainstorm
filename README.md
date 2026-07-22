# Ideia em Movimento

MVP mobile-first de brainstorm empresarial sincronizado. Participantes anônimos entram por área, contribuem em rodadas controladas pelo facilitador e avaliam ideias consolidadas sem ver resultados parciais.

## Arquitetura

- React + TypeScript + Vite + Tailwind no GitHub Pages, com `HashRouter`.
- Supabase Postgres persiste sessões, participantes, rodadas, ideias, grupos e votos.
- Postgres Changes sincroniza a sessão; o cronômetro usa `stage_ends_at` localmente.
- RPCs validadas recebem contribuições e votos. A restrição única no banco impede voto duplicado.
- A Edge Function `admin` guarda a chave privilegiada e valida o PIN. A service role nunca chega ao frontend.
- Ideias originais e consolidadas ficam em tabelas diferentes. O evento pode seguir com grupos manuais se IA falhar.

## Executar localmente

Requisitos: Node 20+, npm e Supabase CLI.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Acesse `/#/s/ALPHA2026` como participante e `/#/admin` como facilitador.

## Configurar Supabase

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase db reset --linked
supabase functions deploy admin --no-verify-jwt
```

Para produção, aplique a migration sem reset e carregue o seed apenas em um projeto de demonstração. O PIN demo é `2468`; troque o hash antes do evento. O endpoint administrativo valida esse hash no banco.

Ative Realtime para `sessions` caso a migration não possa alterar a publication no seu plano. Configure a URL do site em CORS/Functions conforme o domínio do GitHub Pages.

## Segurança do MVP

Todas as tabelas públicas usam RLS. Participantes só escrevem por RPC com token anônimo, estado de sessão e limites validados. Votos individuais não têm `SELECT` público; a view de resultados só retorna linhas quando a sessão está em `RESULTS` ou `FINISHED`. O modelo é apropriado para evento interno de baixo risco, não para dados sensíveis.

Para restauração sem login, o UUID anônimo funciona como uma capacidade. Participantes e ideias não possuem leitura pública direta: restauração, estado e ideias próprias passam por RPCs que validam sessão, participante e token. O painel usa token administrativo temporário, rate limit e auditoria no servidor.

## Agrupamento e fallback

`consolidated_ideas` preserva título, descrição, método, confiança e aprovação; `consolidated_idea_sources` preserva os vínculos com todas as ideias originais. O facilitador pode criar e editar grupos diretamente via operação administrativa, mantendo ideias isoladas com `grouping_method='individual'`. Uma futura Edge Function de IA deve produzir somente JSON estruturado no formato descrito no briefing e inserir sugestões não aprovadas. A votação considera apenas `approved=true`.

## Testes

```bash
npm test
npm run build
```

Os testes cobrem média ponderada, score, percentual, teto 210, peso especialista, áreas neutras, quatro classificações, restauração local e transições. A prevenção definitiva de duplicidade está na constraint `unique(session_id, consolidated_idea_id, participant_id)`; valide-a em integração com `supabase db reset`.

## Deploy no GitHub Pages

Crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, selecione GitHub Actions como fonte de Pages e faça push em `main`. O workflow testa, compila com base path do repositório e publica automaticamente.

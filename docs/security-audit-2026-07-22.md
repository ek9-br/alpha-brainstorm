# Auditoria de permissões — 22/07/2026

## Escopo

Auditoria realizada antes da correção da fase 1 no projeto Supabase compartilhado.

## Constatação

A migration inicial continha `revoke insert, update, delete on all tables in schema public from anon`. O comando também atingiu objetos externos ao brainstorm. Na auditoria posterior, o papel `anon` possuía somente `SELECT`, `REFERENCES`, `TRIGGER` e `TRUNCATE` nas tabelas do sistema de trading; não possuía `INSERT`, `UPDATE` ou `DELETE`.

Não existe histórico suficiente no repositório do brainstorm para determinar quais grants externos existiam antes. Por isso, nenhuma permissão do sistema de trading foi restaurada automaticamente.

## Correção

- A migration inicial foi alterada para citar exclusivamente tabelas `brainstorm_*`.
- A migration corretiva `202607220002_security_hardening.sql` também usa listas explícitas.
- Participantes, ideias, votos e relacionamentos não possuem leitura direta anônima.
- Operações privadas de participante são expostas somente por RPCs que validam sessão, participante e token.
- Objetos administrativos são acessíveis apenas pela `service_role` dentro da Edge Function.

## Pendência externa

As tabelas `market_assets` e `market_asset_sync_runs` continuam sem RLS. Elas não pertencem ao brainstorm e não foram alteradas nesta fase.

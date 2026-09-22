-- =====================================================================
-- `jobs.canais`: todos os canais escolhidos, não só o principal.
--
-- **Este arquivo é uma recuperação, não uma entrega nova.** A coluna está em
-- produção desde 2026-09-11 e não existia migração nenhuma que a criasse: ela
-- foi aplicada à mão, pelo SQL Editor, e o registro ficou só na tabela de
-- histórico do banco. O SQL abaixo foi lido de lá e **não foi reescrito** —
-- uma versão "melhorada" mudaria o comportamento do que está no ar sem
-- ninguém ter pedido, que é a mesma razão pela qual o corpo de
-- `adicionar_membro_existente` foi recuperado tal como estava.
--
-- É a armadilha do agendador ao contrário. Lá, uma migração ficou quatro
-- commits escrita e nunca aplicada, e o produto passou esse tempo sem
-- agendador. Aqui, quem reconstruísse o banco a partir de
-- `supabase/migrations/` — a pasta que este projeto trata como fonte de
-- verdade do schema — ficaria **sem a coluna**, e o multicanal quebraria: o
-- mapper lê `l.canais` e cairia sempre no `[l.platform]`, um canal só, sem
-- erro em lugar nenhum.
--
-- Nada disso é acusado por ferramenta local: `tsc` não conhece coluna do
-- Postgres, o vitest não fala com o banco e o `vite build` não sabe o que é
-- schema. Foi encontrado comparando o catálogo do banco com o que os arquivos
-- criam — 351 colunas em produção, uma sem dono.
--
-- A versão no nome é a original (`20260911012710`), e isso é de propósito:
-- com ela o arquivo casa com o registro que já está no histórico remoto, em
-- vez de virar uma migração nova que tentaria rodar de novo.
-- =====================================================================

alter table public.jobs
    add column if not exists canais jsonb not null default '[]'::jsonb;

-- A linha anterior à coluna tem só o canal principal. Sem este preenchimento
-- o conteúdo antigo abriria com nenhum canal marcado — e salvar por cima
-- apagaria a rede em que ele já foi publicado.
update public.jobs
   set canais = jsonb_build_array(platform)
 where canais = '[]'::jsonb
   and platform is not null;

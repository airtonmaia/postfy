-- =====================================================================
-- Um conteúdo pode ir para mais de uma rede.
--
-- `platform` guardava uma só, e a agência publica a mesma peça no Instagram
-- e no Facebook o tempo todo — o jeito de fazer isso era cadastrar duas
-- vezes, com dois cards e duas aprovações para a mesma arte.
--
-- `platform` **continua existindo e continua sendo o canal principal**: o
-- Kanban, o portal, os relatórios e a fila de publicação leem dela. Trocá-la
-- por uma lista obrigaria a mexer nos cinco de uma vez, e cada um deles é
-- lugar onde um erro só aparece em produção. `canais` é o conjunto completo,
-- e `platform` é sempre o primeiro dele.
-- =====================================================================

alter table public.jobs
    add column if not exists canais jsonb not null default '[]'::jsonb;

-- Linha antiga tem um canal só, e ele é o que está em `platform`. Sem isto a
-- lista nasceria vazia e a tela não mostraria canal nenhum no conteúdo que
-- já existe.
update public.jobs
   set canais = jsonb_build_array(platform)
 where canais = '[]'::jsonb
   and platform is not null;

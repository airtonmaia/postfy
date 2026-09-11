-- =====================================================================
-- Um conteúdo pode ir para mais de uma rede.
--
-- `platform` guardava uma só, e a agência publica a mesma peça no Instagram
-- e no Facebook o tempo todo — o jeito de fazer isso era cadastrar duas
-- vezes: dois cards, duas aprovações, a mesma arte.
--
-- `platform` **continua existindo e continua sendo o canal principal**. O
-- Kanban, o portal, os relatórios e a fila de publicação leem dela; trocá-la
-- por uma lista obrigaria a mexer nos quatro de uma vez, e cada um é lugar
-- onde erro só aparece em produção. `canais` é o conjunto completo, e
-- `platform` é sempre o primeiro dele.
--
-- Aditiva de propósito: enquanto a tela nova não sobe, nada lê `canais`, e o
-- que está no ar continua funcionando igual.
-- =====================================================================

alter table public.jobs
    add column if not exists canais jsonb not null default '[]'::jsonb;

-- Linha antiga tem um canal só — o que está em `platform`. Sem isto a lista
-- nasceria vazia e a tela não mostraria canal nenhum no conteúdo que já existe.
update public.jobs
   set canais = jsonb_build_array(platform)
 where canais = '[]'::jsonb
   and platform is not null;

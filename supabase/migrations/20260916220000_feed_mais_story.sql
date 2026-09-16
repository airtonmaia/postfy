-- Formato "Feed + Story": uma peça, duas saídas.
--
-- O feed e o story têm **proporções diferentes** (4:5 e 9:16) e quase sempre
-- artes diferentes — a mesma imagem num e noutro sai cortada num dos dois. Por
-- isso a arte do story tem coluna própria, e não é o segundo item de
-- `media_urls`: ali o segundo item já significa "página 2 do carrossel", e
-- misturar os dois faria um carrossel de duas páginas virar feed+story sozinho.

alter table public.jobs
    add column if not exists story_media_urls jsonb not null default '[]'::jsonb;

comment on column public.jobs.story_media_urls is
    'Arte do story, quando format = feed_story. Separada de media_urls porque a '
    'proporção é outra (9:16) e o segundo item de media_urls já é página de carrossel.';

-- ---------------------------------------------------------------------------
-- O id do story na fila.
--
-- Uma linha da fila publica **dois** contêineres, e `external_id` guarda o do
-- feed — é ele que `post_metrics` consulta, porque story expira em 24h e não
-- entra no relatório. Sem esta coluna o id do story se perderia, e não haveria
-- como saber se ele saiu.
--
-- Nulo com `status = 'publicado'` significa, portanto, duas coisas diferentes:
-- conteúdo que não é feed_story (a maioria), ou story que falhou depois de o
-- feed sair — e esse caso deixa o motivo em `last_error`, com o item **em
-- publicado**. Marcar falhou ali faria a passada seguinte republicar o feed, e
-- post duplicado no perfil do cliente não volta.
-- ---------------------------------------------------------------------------

alter table public.publish_queue
    add column if not exists story_external_id text;

comment on column public.publish_queue.story_external_id is
    'Id do story publicado, quando o conteúdo é feed_story. external_id continua '
    'sendo o do feed, que é o que post_metrics mede.';

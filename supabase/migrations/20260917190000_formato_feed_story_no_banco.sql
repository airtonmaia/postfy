-- `feed_story` faltava no check de `jobs.format`, e a peça sumia em silêncio.
--
-- =============================================================================
-- O que aconteceu
-- =============================================================================
--
-- A 2.53.0 acrescentou o formato **"Feed + Story"** a `FORMATOS_POR_CANAL`, e
-- com ele a coluna `story_media_urls`, o publicador do story e a prévia. O que
-- ela não acrescentou foi o valor no `check` de `jobs.format`, que desde a
-- primeira migração lista seis formatos e nenhum deles é `feed_story`.
--
-- O efeito é o pior desfecho que este projeto tem:
--
--     23514  new row for relation "jobs" violates check constraint
--            "jobs_format_check"
--
-- **E ninguém vê esse erro.** A persistência é derivada de diff e roda na
-- `filaDeGravacao`, em segundo plano: a tela já mostrou o card, o insert é
-- recusado, e não há aviso em lugar nenhum. Quem escolhe "Feed + Story" e
-- salva vê o conteúdo aparecer, some no F5, e conclui que o sistema "não está
-- cadastrando" — que foi exatamente o relato.
--
-- Medido no banco de produção, com impersonação: das dez criações registradas
-- em `activity_logs` numa tarde, **uma** virou linha em `jobs`. O log é outra
-- coleção da mesma fila, e ele passa — o que torna a falha ainda mais
-- enganosa, porque o histórico de atividade afirma que o conteúdo foi criado.
--
-- =============================================================================
-- A lição, que é mais larga que o formato
-- =============================================================================
--
-- É a armadilha 0 com outra roupa: `tsc` não conhece o `check` do Postgres, o
-- vitest não chama o banco, o `vite build` nem olha para `supabase/`. Os três
-- ficaram verdes por quatro dias com o produto perdendo conteúdo.
--
-- **Lista de valores que a tela oferece e `check` do banco são a mesma decisão
-- escrita em dois lugares.** Divergir não quebra nada na hora — quebra na
-- primeira vez que alguém escolhe o valor novo, longe de quem o escreveu. Por
-- isso a guarda de `tests/formato-no-banco.test.ts` **deriva** a lista de
-- `src/lib/formatos.ts` e de `JobFormat`, e exige que o `check` mais recente
-- aceite cada valor: lista literal na guarda teria de ser editada junto com o
-- código, e editar a guarda junto com o código é como ela deixa de guardar.
--
-- Repetível: `drop constraint if exists` antes de recriar.

alter table public.jobs drop constraint if exists jobs_format_check;

alter table public.jobs
    add constraint jobs_format_check
    check (format in ('feed','carousel','reel','story','video','article','feed_story'));

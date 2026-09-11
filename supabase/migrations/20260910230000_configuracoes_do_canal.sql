-- =====================================================================
-- Cada rede pede campos diferentes.
--
-- O cadastro tratava todo conteúdo igual: legenda, formato, data. Mas
-- publicar num Reel pede capa e "compartilhar no feed"; no YouTube pede
-- descrição, thumbnail, categoria e visibilidade; no LinkedIn, tipo de
-- publicação. Nenhum deles existe nas outras redes.
--
-- Vai em `jsonb` e não em coluna por campo porque o conjunto é esparso e
-- muda com a rede: uma coluna `visibilidade` ficaria nula em todo conteúdo
-- que não é do YouTube, e cada rede nova pediria um `alter table`.
--
-- É o mesmo caminho que `clients.contacts`, `files` e `briefing` já seguem
-- aqui — não é padrão novo.
--
-- O que é comum a todas as redes continua em coluna própria: legenda mora
-- em `caption`, primeiro comentário em `first_comment`. Duplicar aqui
-- criaria duas verdades para o mesmo dado.
-- =====================================================================

alter table public.jobs
    add column if not exists configuracoes jsonb not null default '{}'::jsonb;

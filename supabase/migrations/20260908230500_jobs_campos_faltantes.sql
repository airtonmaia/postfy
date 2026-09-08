-- Campos que existem no tipo Job do app e não tinham coluna correspondente.
-- Sem eles, campanha, público-alvo, etapa de funil, primeiro comentário e link
-- se perderiam silenciosamente na gravação.
alter table public.jobs
    add column if not exists campaign text,
    add column if not exists target_audience text,
    add column if not exists funnel_stage text check (funnel_stage in ('topo','meio','fundo')),
    add column if not exists first_comment text,
    add column if not exists link text,
    add column if not exists published_date timestamptz;

-- A interface identifica cada squad por uma cor; sem coluna ela se perderia
-- na gravação e todos voltariam com a cor padrão.
alter table public.squads
    add column if not exists color text not null default '#6366f1';

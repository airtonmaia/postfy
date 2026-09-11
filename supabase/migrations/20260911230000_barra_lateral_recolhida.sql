-- =====================================================================
-- A barra lateral recolhida é preferência do usuário, e segue com ele.
--
-- Poderia morar no `localStorage`, e é justamente o que a armadilha 4 tirou
-- do projeto: preferência presa a um navegador significa que a mesma pessoa
-- abre no celular e encontra outra coisa. `user_settings` já guarda o tema e
-- a última agência pela mesma razão.
--
-- Não é dado de agência, é de pessoa — por isso a linha é do usuário, com a
-- RLS que já existe (`user_id = auth.uid()`), e não há política para o dono
-- da agência: se um membro recolhe a barra, isso não é assunto de mais
-- ninguém.
--
-- Repetível (`add column if not exists`): o banco é compartilhado entre as
-- duas máquinas e é o de produção.
-- =====================================================================

alter table public.user_settings
    add column if not exists sidebar_recolhida boolean not null default false;

-- Como conferir:
--   select sidebar_recolhida, count(*) from public.user_settings group by 1;

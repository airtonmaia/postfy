-- =====================================================================
-- A tela de aceite precisa saber se o convidado já tem conta.
--
-- Ela abria sempre em "Defina sua senha", como se todo convidado fosse
-- gente nova. Para quem já usa o Orquesia isso é pedir para criar uma conta
-- que já existe: a pessoa tenta, o cadastro recusa o e-mail repetido, e o
-- convite parece quebrado.
--
-- O dado sai junto do convite porque é a mesma consulta e o mesmo token:
-- quem tem o link já foi convidado àquele endereço, então saber que existe
-- conta nele não abre nada que o link não abrisse.
-- =====================================================================

drop function if exists public.convite_por_token(text);

create or replace function public.convite_por_token(t text)
returns table(email text, name text, role text, agencia text, tem_conta boolean)
language sql
stable
security definer
set search_path = ''
as $$
    select
        i.email,
        i.name,
        i.role,
        w.name,
        exists (
            select 1 from auth.users u where lower(u.email) = lower(i.email)
        )
    from public.invites i
    join public.workspaces w on w.id = i.workspace_id
    where i.token = t
      and i.accepted_at is null
      and i.expires_at > now();
$$;

grant execute on function public.convite_por_token(text) to anon, authenticated;

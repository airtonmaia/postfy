-- =====================================================================
-- Marca da agência na porta do portal, antes de existir sessão.
--
-- `/portal-do-cliente` abria com a marca do Orquesia para todo mundo. Para
-- quem é cliente da agência isso é a tela errada: ele foi convidado pela
-- "Pulmin", recebeu um link e chega numa página de outra empresa. O portal é
-- whitelabel — a marca que aparece ali tem que ser a de quem atende.
--
-- Não dá para ler `workspaces` direto: a RLS recorta por `auth.uid()`, e
-- nesta tela ainda não há sessão nenhuma. Daí a função.
-- =====================================================================

create or replace function public.marca_da_agencia(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    -- Devolve SÓ marca, e a lista é fechada de propósito.
    --
    -- Um `select *` aqui entregaria plano, situação de teste, domínio e o que
    -- mais a tabela ganhar depois — para qualquer um, sem sessão. O que sai
    -- daqui é o que já vai estar impresso na tela do portal de qualquer
    -- forma: nome, logo e cores.
    select jsonb_build_object(
        'name', w.name,
        'slug', w.slug,
        'logo', coalesce(w.logo, ''),
        'favicon', w.favicon,
        'primary_color', coalesce(w.primary_color, '#6366f1'),
        'secondary_color', w.secondary_color
    )
    from public.workspaces w
    where w.slug = lower(trim(coalesce(p_slug, '')))
    limit 1;
$$;

-- anon de propósito: quem abre o portal é o cliente da agência, que não tem
-- conta no sistema. O slug não é segredo — ele viaja no link que a agência
-- manda —, e enumerá-lo revela nome e logo de agência, que é exatamente o
-- que uma página whitelabel existe para mostrar.
revoke all on function public.marca_da_agencia(text) from public;
grant execute on function public.marca_da_agencia(text) to anon, authenticated;

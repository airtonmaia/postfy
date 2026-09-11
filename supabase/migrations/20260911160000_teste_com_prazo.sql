-- =====================================================================
-- O teste grátis passa a ter data de fim — e alguém a ler.
--
-- `workspaces.trial_ends_at` existia no schema desde o começo e **ninguém
-- escrevia nela**: das agências na base, zero tinham data. `criar_agencia`
-- insere só nome e slug. O resultado é que o teste nunca terminava, e a
-- checagem que `acesso_da_agencia()` faz sobre essa coluna nunca disparava.
--
-- É a armadilha 9 aplicada à cobrança: uma coluna que parece uma regra e não
-- é. Pior que não ter o campo, porque quem lê o schema conclui que existe
-- limite de teste.
--
-- Agência criada daqui em diante nasce com 14 dias.
--
-- **As que já existem continuam sem data, e isso é decisão.** `trial_ends_at`
-- nulo vale como teste aberto em `acesso_da_agencia()`. Carimbar uma data
-- retroativa agora derrubaria, de uma vez, gente que está usando o produto
-- sem nunca ter sido avisada de que havia prazo. Quem quiser encerrar o teste
-- de uma agência antiga define a data em Admin → Agências.
-- =====================================================================

-- O `default null` do segundo parâmetro **precisa** vir junto: o cadastro
-- chama `criar_agencia(nome)` com um argumento só, e um `create or replace`
-- sem o default é recusado pelo Postgres — que foi o que aconteceu na
-- primeira tentativa. Sem a recusa, seria uma função nova com outra
-- assinatura e o cadastro quebraria em produção.
create or replace function public.criar_agencia(nome text, nome_do_usuario text default null)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
    quem uuid := (select auth.uid());
    base_slug text;
    slug_final text;
    sufixo int := 0;
    nova public.workspaces;
begin
    -- SECURITY DEFINER ignora RLS, então a identidade é conferida aqui.
    if quem is null then
        raise exception 'É preciso estar autenticado para criar uma agência'
            using errcode = '42501';
    end if;

    if nome is null or length(trim(nome)) = 0 then
        raise exception 'Informe o nome da agência' using errcode = '22023';
    end if;

    -- Slug a partir do nome, sem acento e sem colisão.
    base_slug := regexp_replace(
        lower(public.unaccent_simples(trim(nome))),
        '[^a-z0-9]+', '-', 'g'
    );
    base_slug := trim(both '-' from base_slug);
    if length(base_slug) = 0 then
        base_slug := 'agencia';
    end if;
    base_slug := left(base_slug, 50);

    slug_final := base_slug;
    while exists (select 1 from public.workspaces w where w.slug = slug_final) loop
        sufixo := sufixo + 1;
        slug_final := left(base_slug, 50) || '-' || sufixo::text;
    end loop;

    -- 14 dias, e `is_trial` junto: a coluna já era mostrada em Admin →
    -- Agências como "marcada como teste", e sem ela a agência nova apareceria
    -- lá como se fosse pagante desde o primeiro dia.
    insert into public.workspaces (name, slug, is_trial, trial_ends_at)
    values (left(trim(nome), 120), slug_final, true, now() + interval '14 days')
    returning * into nova;

    insert into public.workspace_members (workspace_id, user_id, role, name)
    values (nova.id, quem, 'owner', nullif(trim(coalesce(nome_do_usuario, '')), ''));

    return nova;
end;
$$;

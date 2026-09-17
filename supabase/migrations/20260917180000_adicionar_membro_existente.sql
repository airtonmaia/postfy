-- `adicionar_membro_existente`: a função que estava no banco e em nenhuma
-- migração.
--
-- =============================================================================
-- Por que este arquivo existe
-- =============================================================================
--
-- Ela foi aplicada à mão, direto no banco, e nunca escrita aqui. O produto
-- funciona — é o caminho de "quem já tem conta entra agora", sem convite —,
-- então nada acusava: `tsc` não confere nome de RPC, o vitest não chama o
-- banco, e o `vite build` não sabe o que é uma função do Postgres.
--
-- **É a armadilha do agendador ao contrário.** Lá, uma migração ficou quatro
-- commits escrita e nunca aplicada, e o produto passou esse tempo sem
-- agendador. Aqui a função está aplicada e não estava escrita: quem
-- reconstruísse o banco a partir de `supabase/migrations/` — a pasta que este
-- projeto trata como fonte de verdade do schema — teria um produto onde
-- "Adicionar à agência" falha com `PGRST202`, e o único lugar onde a regra de
-- quem pode adicionar quem estava registrada seria a memória de quem a
-- escreveu.
--
-- O corpo abaixo é o que **está rodando em produção**, recuperado com
-- `pg_get_functiondef` e não reescrito: uma versão "melhorada" aqui mudaria o
-- comportamento do ar sem ninguém ter pedido. As duas decisões que ela carrega
-- ficaram nos comentários originais, que vieram junto.
--
-- Encontrada pela guarda nova de `tests/equipe-e-transferencia.test.ts`, que
-- exige que todo `supabase.rpc` de `src/lib` aponte para função que existe
-- numa migração. A guarda equivalente cobria só `src/lib/portal.ts`, porque
-- foi ali que um nome digitado errado apareceu na frente do cliente — mas a
-- classe do bug nunca foi do portal.

create or replace function public.adicionar_membro_existente(
    agencia uuid,
    email_do_membro text,
    papel text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    quem uuid := (select auth.uid());
    alvo uuid;
    nome_alvo text;
    ja_era boolean;
begin
    if quem is null then
        raise exception 'Não autenticado' using errcode = '42501';
    end if;

    if (select private.papel_na_agencia(agencia)) not in ('owner','admin') then
        raise exception 'Apenas proprietário ou administrador pode adicionar pessoas'
            using errcode = '42501';
    end if;

    -- 'owner' fica de fora: dono se define na criação da agência, não por
    -- adição de terceiro.
    if papel not in ('admin','manager','social_media','designer','copywriter','financial','client') then
        raise exception 'Papel inválido' using errcode = '22023';
    end if;

    select u.id,
           coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name')
      into alvo, nome_alvo
      from auth.users u
     where lower(u.email) = lower(trim(email_do_membro))
     limit 1;

    if alvo is null then
        raise exception 'Não existe conta com este e-mail.' using errcode = 'P0002';
    end if;

    select exists (
        select 1 from public.workspace_members m
         where m.workspace_id = agencia and m.user_id = alvo
    ) into ja_era;

    insert into public.workspace_members (workspace_id, user_id, role, name)
    values (agencia, alvo, papel, nome_alvo)
    on conflict (workspace_id, user_id) do nothing;

    -- Convite pendente para o mesmo e-mail perde a razão de existir: deixá-lo
    -- de pé manteria a linha "aguardando aceite" de alguém que já entrou.
    delete from public.invites
     where workspace_id = agencia
       and lower(email) = lower(trim(email_do_membro))
       and accepted_at is null;

    return jsonb_build_object('ja_era_membro', ja_era, 'user_id', alvo);
end;
$$;

grant execute on function public.adicionar_membro_existente(uuid, text, text) to authenticated;

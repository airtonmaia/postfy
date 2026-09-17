-- O e-mail de cada membro, e a transferência da agência.
--
-- =============================================================================
-- 1. A equipe sem e-mail
-- =============================================================================
--
-- A tela de Configurações → Usuários mostrava "Membro da agência" embaixo do
-- nome, e o e-mail só do próprio usuário logado. Não era desleixo: o e-mail
-- mora em `auth.users`, que **nenhuma sessão autenticada lê** — o cliente
-- montava a lista de `workspace_members`, onde só há nome e avatar, e para os
-- outros escrevia string vazia.
--
-- Numa equipe com dois "Airton", o nome não distingue ninguém: é o e-mail que
-- diz para qual conta o convite foi, quem tem qual acesso, e quem remover.
--
-- **Por que uma função e não uma coluna `email` em `workspace_members`.** A
-- tabela já denormaliza `name` e `avatar`, e o e-mail seria o terceiro — mas
-- os dois primeiros são editáveis pela própria pessoa no perfil, enquanto o
-- e-mail é a credencial de login: uma cópia dele envelhece em silêncio no dia
-- em que alguém troca o endereço da conta, e a tela passaria a mostrar o
-- antigo com cara de certo. A função lê a fonte.
--
-- =============================================================================
-- 2. Transferir a agência
-- =============================================================================
--
-- Não havia como. Quem criou a agência é `owner` para sempre, e a pessoa que
-- de fato a administra fica em `admin` — que na prática pode quase tudo, mas
-- não é dona: o papel aparece na tela, e a conta que sai da empresa continua
-- sendo a proprietária no banco.
--
-- Três regras, e nenhuma é detalhe:
--
--   1. **Só o dono transfere.** Um `admin` pode quase tudo *dentro* da
--      agência; deixá-lo transferir seria deixá-lo tomá-la. É a diferença
--      entre administrar e ser dono, e é a única coisa que separa os dois
--      papéis hoje.
--   2. **Quem transfere vira `admin`, não perde o acesso.** Transferir e ser
--      expulso no mesmo clique é armadilha: a pessoa que passa a agência
--      adiante quase sempre continua trabalhando nela.
--   3. **O destino precisa ser membro ativo.** Promover quem não está na
--      equipe criaria um dono que a lista de membros não mostra — e ninguém
--      conseguiria desfazer, porque desfazer exige ser o dono.
--
-- =============================================================================
-- 3. O gatilho recusava o último passo da transferência
-- =============================================================================
--
-- `private.checar_edicao_de_membro` barra **qualquer** sessão que mexa no
-- próprio papel, e a regra existe por um motivo certo: fechar a
-- auto-promoção. Mas o último passo da transferência é exatamente isto — quem
-- transfere se rebaixa a `admin` —, e o gatilho o recusava com `42501`.
--
-- Ser `security definer` não ajuda: `auth.uid()` lê o JWT da sessão, não o
-- dono da função, então dentro da `transferir_agencia` o ator continua sendo
-- quem chamou.
--
-- **A exceção é estreita de propósito: sair de `owner` para `admin`.** Não é
-- promoção — é o oposto —, e a última regra do gatilho, que já existia,
-- é quem garante que a agência não fica sem dono: ela conta os outros donos
-- ativos e recusa se não houver nenhum. Por isso a ordem dentro da
-- `transferir_agencia` não é estilo: **promove primeiro, rebaixa depois.** Ao
-- contrário, o rebaixamento acontece quando o destino ainda é `admin`, não há
-- outro dono ativo, e o gatilho — com razão — recusa.
--
-- O que **não** passa a ser permitido, e é o que importa: `admin` virar
-- `owner` por conta própria (a terceira regra segura), e alguém mexer no
-- próprio `ativo` (a exceção exige os dois lados ativos).

-- -----------------------------------------------------------------------------
-- 1. A equipe, com e-mail
-- -----------------------------------------------------------------------------

create or replace function public.equipe_da_agencia(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    /*
      **A conferência de pertencimento é a função inteira.**

      Ela é `security definer` e lê `auth.users`: sem esta linha, qualquer
      sessão autenticada passaria o id de outra agência e teria a lista de
      e-mails dela. É o mesmo cuidado do `portal_dados`, que confere o token
      antes de devolver qualquer coisa.
    */
    if not exists (
        select 1 from public.workspace_members m
         where m.workspace_id = p_workspace_id
           and m.user_id = auth.uid()
    ) then
        return '[]'::jsonb;
    end if;

    return coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'user_id', m.user_id,
                'role', m.role,
                'name', m.name,
                'avatar', m.avatar,
                'ativo', m.ativo,
                'created_at', m.created_at,
                'email', u.email
            ) order by
                -- O dono primeiro, e depois por ordem de entrada: é como a
                -- tela já lista, e a ordenação no banco poupa a tela de
                -- reordenar o que ela recebeu.
                case when m.role = 'owner' then 0 else 1 end,
                m.created_at
        )
        from public.workspace_members m
        left join auth.users u on u.id = m.user_id
        where m.workspace_id = p_workspace_id
    ), '[]'::jsonb);
end;
$$;

grant execute on function public.equipe_da_agencia(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. O gatilho abre uma exceção para quem desce de dono para admin
-- -----------------------------------------------------------------------------
--
-- Repetido por inteiro (a função é substituída, não emendada) a partir de
-- 20260909140000_gestao_de_membros.sql. Só a primeira regra mudou.

create or replace function private.checar_edicao_de_membro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    ator uuid := (select auth.uid());
    papel_do_ator text;
    outros_donos integer;
begin
    -- Sem sessão é rotina de serviço (RPC de aceite de convite, migração):
    -- essas já validam por conta própria.
    if ator is null then
        return new;
    end if;

    select m.role into papel_do_ator
    from public.workspace_members m
    where m.workspace_id = new.workspace_id
      and m.user_id = ator
      and m.ativo;

    -- Fecha a auto-promoção: o papel e o acesso de alguém são sempre
    -- decisão de outra pessoa.
    --
    -- A exceção é descer de `owner` para `admin`, que é o último passo de
    -- `transferir_agencia` e o oposto de uma promoção. Ela não abre a porta
    -- que esta regra fecha: quem é `admin` continua sem conseguir virar
    -- `owner` sozinho (a terceira regra), e mexer no próprio `ativo` continua
    -- barrado — a exceção exige os dois lados ativos. Quem garante que a
    -- agência não fica sem dono é a última regra, mais abaixo.
    if new.user_id = ator
       and (new.role is distinct from old.role or new.ativo is distinct from old.ativo)
       and not (old.role = 'owner' and new.role = 'admin' and old.ativo and new.ativo) then
        raise exception 'Você não pode alterar o próprio papel nem o próprio acesso.'
            using errcode = '42501';
    end if;

    if old.role = 'owner' and coalesce(papel_do_ator, '') <> 'owner' then
        raise exception 'Só o proprietário pode alterar outro proprietário.'
            using errcode = '42501';
    end if;

    if new.role = 'owner' and old.role <> 'owner' and coalesce(papel_do_ator, '') <> 'owner' then
        raise exception 'Só o proprietário pode promover alguém a proprietário.'
            using errcode = '42501';
    end if;

    -- Uma agência sem dono ativo não tem quem gerencie plano, equipe nem
    -- exclusão: ninguém consegue desfazer o passo seguinte.
    if old.role = 'owner' and old.ativo
       and (new.role <> 'owner' or not new.ativo) then
        select count(*) into outros_donos
        from public.workspace_members m
        where m.workspace_id = old.workspace_id
          and m.role = 'owner'
          and m.ativo
          and m.user_id <> old.user_id;

        if outros_donos = 0 then
            raise exception 'A agência precisa de pelo menos um proprietário ativo.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists membro_editado on public.workspace_members;
create trigger membro_editado
    before update on public.workspace_members
    for each row execute function private.checar_edicao_de_membro();

-- -----------------------------------------------------------------------------
-- 3. Transferir a agência
-- -----------------------------------------------------------------------------

create or replace function public.transferir_agencia(
    p_workspace_id uuid,
    p_novo_dono uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_papel text;
begin
    -- Só o dono. Ver o cabeçalho: admin administra, dono transfere.
    select m.role into v_papel
      from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = auth.uid();

    if v_papel is distinct from 'owner' then
        raise exception 'Só o proprietário da agência pode transferi-la.'
            using errcode = '42501';
    end if;

    if p_novo_dono = auth.uid() then
        raise exception 'A agência já é sua.' using errcode = '22023';
    end if;

    -- O destino precisa estar na equipe, e ativo.
    if not exists (
        select 1 from public.workspace_members m
         where m.workspace_id = p_workspace_id
           and m.user_id = p_novo_dono
           and m.ativo
    ) then
        raise exception 'A pessoa precisa ser membro ativo da agência.'
            using errcode = '22023';
    end if;

    /*
      As duas escritas são uma só operação: a função é uma transação, então
      ou a agência troca de dono por inteiro ou nada muda. Meio caminho aqui
      deixaria a agência com dois donos — ou com nenhum, que é pior: sem dono
      ninguém pode transferir de volta.

      **A ordem não é estilo: promove primeiro, rebaixa depois.** O gatilho
      `membro_editado` recusa deixar a agência sem nenhum dono ativo, e ele
      olha o estado da tabela na hora. Rebaixando antes, o destino ainda é
      `admin`, não há outro dono, e a transferência inteira falha com `42501`.
    */
    update public.workspace_members
       set role = 'owner'
     where workspace_id = p_workspace_id
       and user_id = p_novo_dono;

    -- Quem transfere fica como admin: continua trabalhando na agência.
    update public.workspace_members
       set role = 'admin'
     where workspace_id = p_workspace_id
       and user_id = auth.uid();

    insert into public.activity_logs (workspace_id, user_name, action, target)
    values (
        p_workspace_id,
        coalesce(
            (select m.name from public.workspace_members m
              where m.workspace_id = p_workspace_id and m.user_id = auth.uid()),
            'Alguém'
        ),
        'Transferiu a propriedade da agência',
        coalesce(
            (select m.name from public.workspace_members m
              where m.workspace_id = p_workspace_id and m.user_id = p_novo_dono),
            p_novo_dono::text
        )
    );

    return true;
end;
$$;

grant execute on function public.transferir_agencia(uuid, uuid) to authenticated;

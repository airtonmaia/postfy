-- =====================================================================
-- Quem chega por convite não ganha agência própria
-- =====================================================================
--
-- Bug real: o convidado se cadastrava pelo link do convite e o app criava
-- uma agência para ele ("Agência de Fulano") antes de o vínculo com a agência
-- de quem convidou existir. Resultado: a pessoa ficava em duas agências, e
-- como a escolha da agência inicial era o primeiro membro que o Postgres
-- devolvesse, ela caía na própria — vazia — em vez da agência para a qual
-- foi convidada. Parecia que o convite não tinha funcionado.
--
-- A correção principal é no cliente (não chamar a criação no fluxo de
-- convite), mas ela sozinha não basta: há um segundo caminho para o mesmo
-- estado. Se o projeto exige confirmação de e-mail, o cadastro não abre
-- sessão; a pessoa confirma o e-mail, entra pela tela de login normal — e é
-- ali que a criação automática dispara, antes de o convite ser aceito.
--
-- Daí esta função: a criação automática pergunta ao banco se existe convite
-- pendente para o e-mail da sessão e, se existir, não cria nada. O convite
-- fica esperando o aceite.

create or replace function public.tenho_convite_pendente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    -- SECURITY DEFINER porque a RLS de invites só deixa owner/admin ler, e
    -- o convidado é justamente quem não é nenhum dos dois ainda.
    --
    -- Não vaza nada: a resposta é um booleano sobre o próprio e-mail da
    -- sessão. Não diz de qual agência é o convite, nem quem convidou, nem
    -- expõe o token — que continua sendo a única forma de aceitar.
    select exists (
        select 1
          from public.invites i
          join auth.users u on lower(u.email) = lower(i.email)
         where u.id = (select auth.uid())
           and i.accepted_at is null
           and i.expires_at > now()
    );
$$;

revoke execute on function public.tenho_convite_pendente() from public, anon;
grant execute on function public.tenho_convite_pendente() to authenticated;

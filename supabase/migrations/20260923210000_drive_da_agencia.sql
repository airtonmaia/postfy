-- ---------------------------------------------------------------------
-- O Google Drive da agência: conectado uma vez, usado sempre
--
-- A primeira versão pedia autorização **a cada peça**, no navegador: quem
-- monta dez posts numa tarde autorizava dez vezes, com a janela do Google
-- abrindo no meio do trabalho. Agora a agência conecta uma conta em
-- Configurações → Integrações e todo mundo dela escolhe arquivos por ali —
-- o mesmo modelo da conta de Instagram, e pela mesma razão.
--
-- **São duas tabelas, e a divisão é a mesma de `social_connections` e
-- `social_tokens`**: o que a tela precisa mostrar fica alcançável pela
-- agência; a credencial não é alcançável por sessão nenhuma.
-- ---------------------------------------------------------------------

-- O que a tela mostra: qual conta, quem conectou, quando.
create table if not exists public.drive_da_agencia (
    workspace_id uuid primary key
        references public.workspaces(id) on delete cascade,
    -- De quem é a conta. Sem isto, "Drive conectado" não diz de quem — e a
    -- agência que conectar a conta errada só descobre quando não acha os
    -- arquivos. Nulo é "o Google não devolveu", não "ninguém".
    email text,
    conectado_por uuid,
    conectado_em timestamptz not null default now()
);

alter table public.drive_da_agencia enable row level security;

drop policy if exists "membro ve o drive da agencia" on public.drive_da_agencia;
create policy "membro ve o drive da agencia"
    on public.drive_da_agencia for select
    using (private.papel_na_agencia(workspace_id) is not null);

-- **Sem política de escrita, de propósito.** Quem escreve é
-- `api/social-callback.ts`, com a chave de serviço, a partir do que o Google
-- respondeu. Uma política aqui deixaria o navegador afirmar uma conexão que
-- não existe — e a tela passaria a oferecer um Drive que não abre.
--
-- A exceção é apagar: desconectar é decisão de quem administra, e precisa
-- funcionar mesmo que a rota esteja fora do ar. O token some junto, pelo
-- `on delete cascade` abaixo.
drop policy if exists "gestor desconecta o drive" on public.drive_da_agencia;
create policy "gestor desconecta o drive"
    on public.drive_da_agencia for delete
    using (private.papel_na_agencia(workspace_id) in ('owner', 'admin', 'manager'));

-- ---------------------------------------------------------------------
-- A credencial: RLS ligada e **zero políticas**
--
-- Como `social_tokens` e `portal_codigos`: inalcançável por qualquer sessão
-- autenticada, inclusive a do dono da agência. Só a função serverless a lê,
-- com a chave de serviço.
--
-- O `refresh_token` é o que dá acesso continuado ao Drive de quem autorizou.
-- Ele nunca vai para o navegador: o que a aba recebe é um token de acesso de
-- uma hora, pedido à rota e usado para abrir o seletor e baixar o arquivo.
-- ---------------------------------------------------------------------
create table if not exists public.drive_credenciais (
    workspace_id uuid primary key
        references public.drive_da_agencia(workspace_id) on delete cascade,
    refresh_token text not null,
    -- O último token de acesso e quando ele vence, para não pedir um novo ao
    -- Google a cada peça. Nulo é "não tenho", e aí é só renovar.
    access_token text,
    expira_em timestamptz,
    atualizado_em timestamptz not null default now()
);

alter table public.drive_credenciais enable row level security;

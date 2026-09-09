-- ---------------------------------------------------------------------
-- Modelos dos e-mails automáticos do sistema
--
-- São disparos do produto, não de uma agência: o texto que o cliente final
-- recebe ao ter conteúdo esperando aprovação é o mesmo para toda a base.
-- Por isso a tabela não tem workspace_id e o acesso é do admin da
-- plataforma.
--
-- Só existe política de SELECT e UPDATE. Criar ou apagar evento é mudança de
-- código — o disparo precisa de um gatilho correspondente na aplicação, e uma
-- linha órfã aqui seria um e-mail que nunca sai ou um gatilho sem texto.
-- ---------------------------------------------------------------------
create table if not exists public.email_templates (
    evento text primary key,
    nome text not null,
    descricao text not null,
    destinatario text not null check (destinatario in ('cliente', 'agencia')),
    ativo boolean not null default true,
    assunto text not null,
    corpo text not null,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id) on delete set null
);

alter table public.email_templates enable row level security;

-- Leitura para qualquer sessão autenticada, escrita só para o admin da
-- plataforma.
--
-- O texto do e-mail não é segredo, e quem dispara é um membro comum da
-- agência: se só o admin pudesse ler, o gatilho não encontraria o modelo e o
-- e-mail simplesmente não sairia. Editar é que precisa ser restrito.
drop policy if exists "autenticado le os modelos" on public.email_templates;
create policy "autenticado le os modelos"
    on public.email_templates for select
    to authenticated
    using (true);

drop policy if exists "admin da plataforma edita os modelos" on public.email_templates;
create policy "admin da plataforma edita os modelos"
    on public.email_templates for update
    using (private.eh_admin_da_plataforma())
    with check (private.eh_admin_da_plataforma());

-- Os quatro disparos que o fluxo de aprovação já produz.
insert into public.email_templates (evento, nome, descricao, destinatario, assunto, corpo) values
('conteudo_aguardando_aprovacao',
 'Conteúdo aguardando aprovação',
 'Enviado ao cliente quando um conteúdo entra em "Aguardando aprovação".',
 'cliente',
 'Conteúdo "{{titulo}}" aguardando sua aprovação',
 E'Olá, {{cliente}}\n\n{{agencia}} enviou "{{titulo}}" para aprovação.\n\nVocê pode revisar e aprovar pelo botão abaixo.'),

('conteudo_aprovado',
 'Conteúdo aprovado',
 'Enviado à agência quando o cliente aprova um conteúdo.',
 'agencia',
 '[{{titulo}}] foi aprovado!',
 E'Olá, {{agencia}}\n\n{{cliente}} aprovou "{{titulo}}".\n\nO conteúdo está liberado para publicação.'),

('pedido_de_ajuste',
 'Pedido de ajustes',
 'Enviado à agência quando o cliente solicita alterações.',
 'agencia',
 '[{{titulo}}] recebeu um pedido de ajustes.',
 E'Olá, {{agencia}}\n\n{{cliente}} solicitou os seguintes ajustes em "{{titulo}}":\n\n{{feedback}}'),

('boas_vindas',
 'Boas-vindas',
 'Enviado a quem acaba de criar uma agência.',
 'agencia',
 'Bem-vindo ao Orquesia! Vamos configurar sua agência?',
 E'Olá, {{agencia}}\n\nSeu acesso já está ativo. Para começar:\n\n- Personalize sua identidade visual\n- Cadastre seus clientes\n- Envie o primeiro conteúdo para aprovação')
on conflict (evento) do nothing;

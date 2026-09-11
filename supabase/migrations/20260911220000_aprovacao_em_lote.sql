-- =====================================================================
-- Aprovação em lote: a agência escolhe se o cliente é avisado a cada arte
-- ou uma vez só, por grupo.
--
-- O disparo por arte é o certo para quem produz pouco. Para quem manda dez
-- peças na segunda-feira, ele vira dez e-mails em quinze minutos — e o
-- efeito é o cliente parar de abrir todos, que é pior do que não avisar.
--
-- Duas coisas mudam de forma:
--
-- 1. `workspaces.notificacao_aprovacao` diz qual dos dois modos vale. O
--    padrão é `cada`, que é o comportamento que já existia: agência que não
--    mexer em nada não percebe diferença nenhuma.
--
-- 2. `email_queue` passa a aceitar uma linha que fala de **vários**
--    conteúdos. Por isso `job_id` deixa de ser obrigatório e entram
--    `client_id` e `quantidade` — sem eles, avisar sobre dez peças exigiria
--    dez linhas, que é exatamente o que o modo de lote existe para evitar.
--
-- Repetível de propósito (`if not exists`, `drop constraint if exists`,
-- `on conflict do nothing`): o banco é compartilhado entre as duas máquinas
-- e é o de produção.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A preferência, na agência
-- ---------------------------------------------------------------------
alter table public.workspaces
    add column if not exists notificacao_aprovacao text not null default 'cada';

alter table public.workspaces
    drop constraint if exists workspaces_notificacao_aprovacao_check;

alter table public.workspaces
    add constraint workspaces_notificacao_aprovacao_check
    check (notificacao_aprovacao in ('cada', 'lote'));

-- ---------------------------------------------------------------------
-- 2. A fila de e-mail aceita um aviso sobre vários conteúdos
--
-- `job_id` era `not null` porque todo evento falava de uma peça só. O aviso
-- de lote fala de um cliente e de uma contagem, então ele nasce sem job.
--
-- A restrição abaixo é o que impede a linha órfã: ou há conteúdo, ou há
-- cliente. Uma linha sem os dois não teria como ser endereçada, e o cron
-- descobriria isso na hora de enviar — tarde demais para alguém corrigir.
-- ---------------------------------------------------------------------
alter table public.email_queue alter column job_id drop not null;

alter table public.email_queue
    add column if not exists client_id uuid references public.clients(id) on delete cascade;

alter table public.email_queue
    add column if not exists quantidade integer;

alter table public.email_queue
    drop constraint if exists email_queue_tem_alvo_check;

alter table public.email_queue
    add constraint email_queue_tem_alvo_check
    check (job_id is not null or client_id is not null);

-- O check do evento é recriado, e não alterado: o Postgres não tem
-- `alter constraint` para mudar a expressão.
alter table public.email_queue drop constraint if exists email_queue_evento_check;

alter table public.email_queue
    add constraint email_queue_evento_check
    check (evento in (
        'conteudo_aguardando_aprovacao',
        'conteudo_aprovado',
        'pedido_de_ajuste',
        'lote_aguardando_aprovacao'
    ));

-- ---------------------------------------------------------------------
-- 3. O modelo do e-mail de lote
--
-- `on conflict do nothing` porque o texto é editável em Admin → E-mails: se
-- a migração rodar de novo, o que o dono escreveu não pode ser sobrescrito
-- pelo padrão.
-- ---------------------------------------------------------------------
insert into public.email_templates (evento, nome, descricao, destinatario, assunto, corpo) values
('lote_aguardando_aprovacao',
 'Conteúdos aguardando aprovação (lote)',
 'Enviado ao cliente quando a agência dispara a aprovação em massa. Substitui o aviso por arte nas agências que escolheram agrupar.',
 'cliente',
 'Você tem {{quantidade}} conteúdo(s) para aprovar',
 E'Olá, {{cliente}}\n\n{{agencia}} enviou {{quantidade}} conteúdo(s) para a sua aprovação.\n\nAbra o portal pelo botão abaixo para revisar todos de uma vez.')
on conflict (evento) do nothing;

-- ---------------------------------------------------------------------
-- Como conferir:
--
--   select notificacao_aprovacao, count(*) from public.workspaces
--    group by 1;
--
--   select evento, count(*) from public.email_queue group by 1;
-- ---------------------------------------------------------------------

-- =====================================================================
-- `comment` entra no check de notifications.type — e com ele o chat do
-- portal volta a existir.
--
-- `portal_comentar` grava a mensagem do cliente e, logo depois, insere a
-- notificação da agência com `type = 'comment'`. Esse valor **nunca esteve**
-- no check, que aceita `approval`, `adjustment`, `publication`, `system`,
-- `lead` e (desde a migração anterior) `portal`.
--
-- O desfecho é o pior possível, e é pior que o do `feed_story`: o insert
-- falha com `23514`, a função **não tem tratamento de exceção**, e o
-- `update public.jobs` que gravou o comentário vem **antes** dele. A exceção
-- sobe, a transação inteira é desfeita, e a mensagem que o cliente acabou de
-- escrever é descartada com ela.
--
-- Medido no banco de produção antes da correção: **zero** notificações do
-- tipo `comment` em 28, e o insert reproduzido à mão devolve
-- `23514 violates check constraint "notifications_type_check"`.
--
-- A tela do portal diz que a mensagem foi enviada, porque a pintura vem
-- antes da resposta do banco. Um chat mudo é pior que chat nenhum: o cliente
-- escreve, fica esperando resposta de uma mensagem que nunca chegou, e a
-- agência nunca soube que ele falou.
--
-- **A regra que fica é a que este arquivo já registra, num lugar novo:**
-- lista fechada na tela e `check` no banco são a mesma decisão em dois
-- lugares — e o "na tela" inclui o literal que uma função do próprio
-- Postgres escreve. `tests/avisos-do-portal.test.ts` passou a derivar os
-- tipos que as migrações inserem, além dos que o TypeScript declara.
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
    check (type in (
        'approval',
        'adjustment',
        'publication',
        'system',
        'lead',
        -- O cliente abriu o portal.
        'portal',
        -- O cliente escreveu na thread de revisão. Recriar o check é
        -- reescrever a lista inteira: esquecer um valor que já existe é o
        -- que derruba a funcionalidade do vizinho em silêncio.
        'comment'
    ));

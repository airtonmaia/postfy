-- =====================================================================
-- O que está sendo aprovado: conteúdo, copy ou roteiro.
--
-- Até aqui todo job era a mesma coisa — uma arte com legenda. Mas a agência
-- manda para aprovação três entregas de natureza diferente, e o cliente
-- aprova cada uma olhando para outra coisa:
--
--   conteudo — a arte pronta. É o caso que já existia.
--   copy     — só o texto. Não tem arte para olhar.
--   roteiro  — o roteiro de uma gravação. Também não tem arte.
--
-- Sem essa coluna o tipo viveria só na tela, e sumiria no primeiro reload —
-- o card voltaria a pedir aprovação de uma imagem que nunca existiu.
--
-- `default 'conteudo'` porque é o que as 10 linhas existentes são, e porque
-- é o caminho mais comum: quem não escolhe, cai nele.
-- =====================================================================

alter table public.jobs
    add column if not exists tipo text not null default 'conteudo';

-- Lista fechada no banco, e não só no TypeScript: o `check` é o que impede um
-- valor inventado de entrar por uma rota que o front não conhece.
alter table public.jobs
    drop constraint if exists jobs_tipo_valido;

alter table public.jobs
    add constraint jobs_tipo_valido
    check (tipo in ('conteudo', 'copy', 'roteiro'));

-- Rascunho do conteúdo: o texto de trabalho, ao lado da legenda.
--
-- `jobs.caption` é o texto que **vai publicado** — ele é enviado à Meta em
-- `api/_lib/instagram.ts`, conta contra o limite de caracteres da rede e
-- aparece na prévia. O rascunho é o oposto disso: versão descartada da
-- legenda, ideia de gancho, o que o cliente falou na reunião.
--
-- Por isso é **coluna própria** e não um campo dentro de `caption`. Os dois
-- num texto só significaria publicar o rascunho junto na primeira vez que
-- alguém esquecesse de apagar — e o que sai no perfil do cliente não volta.
--
-- Sem `not null` e sem default: nulo é "nunca escreveram nada aqui", e é o
-- estado da esmagadora maioria das linhas que já existem.

alter table public.jobs
    add column if not exists draft text;

comment on column public.jobs.draft is
    'Texto de trabalho do conteúdo (rascunho da legenda, anotações do post). '
    'NUNCA é publicado: quem vai para a rede é caption.';

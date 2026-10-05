-- O perfil da conta conectada: foto, nome, tipo e quantidade de publicações.
--
-- `social_connections` guardava o id, o `@usuário` e — só para o Facebook — os
-- seguidores. Isso responde "está conectada?" e não responde "é esta conta
-- mesmo?", que é a pergunta de quem administra vários perfis parecidos.
--
-- O gatilho imediato é a análise da Meta: `instagram_business_basic` exige que
-- o app **exiba** informações do perfil profissional conectado — nome de
-- usuário, foto, dados do perfil —, e o Orquesia mostrava só o arroba. Mas a
-- razão para ficar é outra e vale por si: conectar o perfil errado só aparece
-- quando o post do cliente sai no lugar errado, e aí não volta.
--
-- Nenhuma coluna tem `default 0`, e isso é a regra deste schema: **nulo é "não
-- medi", zero é "medi e deu zero"**. Um `default 0` em `publicacoes` faria uma
-- leitura que falhou parecer um perfil sem nenhuma publicação — e a tela
-- afirmaria, com cara de certo, algo que ninguém mediu.
--
-- Repetível de propósito: o banco é compartilhado e é produção, então esta
-- migração pode ser aplicada de novo, ou pela outra máquina sem saber que já
-- foi, sem quebrar nada.

alter table public.social_connections
    add column if not exists foto_url text;

comment on column public.social_connections.foto_url is
    'Foto do perfil conectado. Vem de profile_picture_url no Instagram e de picture{url} na Página.';

alter table public.social_connections
    add column if not exists nome_do_perfil text;

comment on column public.social_connections.nome_do_perfil is
    'O nome de exibição, que não é o @usuário: "Go7 Agência Digital" vs @go7digital.';

alter table public.social_connections
    add column if not exists tipo_de_conta text;

comment on column public.social_connections.tipo_de_conta is
    'BUSINESS ou MEDIA_CREATOR no Instagram; a categoria da Página no Facebook. É o que prova que a conta é profissional.';

alter table public.social_connections
    add column if not exists publicacoes integer;

comment on column public.social_connections.publicacoes is
    'Quantas publicações o perfil tem. Nulo é "não medi" — nunca zero, que seria um perfil vazio.';

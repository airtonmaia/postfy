-- ---------------------------------------------------------------------
-- Quantos seguidores a conta conectada tem, e quando isso foi medido
--
-- A conexão do Facebook mostrava só o nome da Página, que vem de
-- `/me/accounts`. Quem administra várias Páginas com nomes parecidos
-- ("Loja", "Loja Oficial") não tem como conferir, pelo nome, que conectou a
-- certa — e conectar a errada só aparece quando o post do cliente sai no
-- perfil de outro negócio. O número de seguidores é o que distingue as duas
-- de relance.
--
-- **As duas colunas andam juntas, e a segunda é o que torna a primeira
-- honesta.** Seguidor é número que muda todo dia: mostrá-lo sem dizer quando
-- foi medido é a tela afirmando o de hoje com o dado de um mês atrás. A
-- mesma regra de `post_metrics`, onde `medido_em` existe pela mesma razão.
--
-- Nulo é "não medi", nunca zero — `default 0` faria uma conexão antiga
-- parecer uma Página sem ninguém. Pelo mesmo motivo não há `default` aqui.
-- ---------------------------------------------------------------------
alter table public.social_connections
    add column if not exists seguidores integer;

alter table public.social_connections
    add column if not exists seguidores_em timestamptz;

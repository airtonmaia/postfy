-- ---------------------------------------------------------------------
-- Saem `drive_da_agencia` e `drive_credenciais`
--
-- A migração `20260924140000_varias_contas_do_drive.sql` copiou as linhas
-- para `drive_contas` / `drive_contas_credenciais` e deixou as originais
-- intactas, com o motivo escrito nela: **a `main` é o que está no ar**, e o
-- código publicado naquele momento ainda lia as duas. Um `drop` ali teria
-- derrubado produção entre a migração e o deploy.
--
-- A condição de saída que ela registrou está cumprida, e foi conferida antes
-- deste arquivo existir:
--
--   * nenhuma referência a `drive_da_agencia` nem a `drive_credenciais` em
--     `src/` ou `api/` — a busca devolve zero;
--   * a única linha que havia (`pulmindigital@gmail.com`, agência
--     `dc5ed5e6…`) está em `drive_contas`, conferida por `workspace_id` +
--     `email`, e não por contagem: duas tabelas com "um registro cada"
--     também é o que se vê quando a cópia gravou a linha errada.
--
-- ### Sem `cascade`, de propósito
--
-- `drop table` já leva junto as políticas e os índices da própria tabela,
-- que é tudo o que estas duas têm. O `cascade` serviria para arrastar um
-- dependente inesperado — uma view, uma função, uma chave estrangeira de
-- algo que ninguém lembrava — e é exatamente isso que **não** se quer aqui:
-- sem ele a migração falha alto, nomeando o dependente; com ele, ela apaga
-- o dependente em silêncio e a descoberta acontece na frente de alguém.
--
-- A ordem é a da dependência: a credencial referencia a agência na outra
-- tabela, então ela sai primeiro.
-- ---------------------------------------------------------------------

drop table if exists public.drive_credenciais;

drop table if exists public.drive_da_agencia;

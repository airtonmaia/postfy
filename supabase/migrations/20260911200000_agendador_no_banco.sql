-- =====================================================================
-- O agendador sai do GitHub Actions e passa para o banco.
--
-- POR QUÊ, com número: o workflow `publicar.yml` está agendado em
-- `*/5 * * * *`, o que dá 12 passadas por hora. Medido em 2026-09-11, ele
-- rodou **15 vezes em 52,6 horas** — 2,4% do esperado, com intervalos reais
-- de 2 a 5 horas entre passadas.
--
-- O comentário do workflow assumia outra coisa: "pode atrasar sob carga —
-- aceitável para post agendado, que já tolera minutos". Atraso de minutos
-- seria. Atraso de horas não é: um post marcado para as 10:00 sai às 14:00,
-- no perfil do cliente, e é a agência que explica.
--
-- O agendamento do GitHub é best-effort por definição — a própria
-- documentação deles avisa que `schedule` é adiado sob carga e que não há
-- garantia de execução. Não é defeito de configuração; é o serviço.
--
-- `pg_cron` roda dentro do Postgres que já é nosso. Não entra fornecedor
-- novo, o segredo não sai de casa, e o histórico de cada passada fica em
-- `cron.job_run_details`, consultável.
--
-- Repetível de propósito (`if not exists`, `create or replace`, unschedule
-- antes de schedule): o banco é compartilhado entre as duas máquinas e é o
-- de produção, então esta migração pode ser aplicada de novo sem quebrar
-- nada.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- `with schema extensions` registra a extensão ali, mas as funções do
-- pg_net **não** vão junto: ele fixa o schema `net` no próprio control
-- file, e é em `net.http_get` que elas ficam. Escrever
-- `extensions.net.http_get(...)` não é um schema errado — é um nome de três
-- partes, que o Postgres lê como *banco*.*schema*.*função* e recusa com
--
--     0A000: cross-database references are not implemented
--
-- O custo disso é o que importa: `create or replace function` **aceita** o
-- corpo sem conferir nada, porque PL/pgSQL só resolve nomes na execução.
-- A migração aplica limpa, o `cron.schedule` grava, e a falha só aparece na
-- primeira passada — como uma linha em `cron.job_run_details` que ninguém
-- está olhando. Nada publica, e a fila fica cheia de `pendente` sem
-- explicação.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- O segredo NÃO mora aqui.
--
-- `CRON_SECRET` é lido do Vault do Supabase, pelo nome. Escrevê-lo nesta
-- migração o mandaria para o git — e o projeto já carrega uma pendência
-- exatamente assim: uma senha em dois commits antigos, que só sai
-- reescrevendo a branch.
--
-- Quem cadastra é você, uma vez, no SQL Editor (fora do git):
--
--     select vault.create_secret(
--         '<o mesmo valor que está na Vercel>',
--         'cron_secret',
--         'Bearer de /api/publicar'
--     );
--
-- Para trocar depois:
--
--     select vault.update_secret(
--         (select id from vault.secrets where name = 'cron_secret'),
--         '<novo valor>'
--     );
-- ---------------------------------------------------------------------

create or replace function private.disparar_publicador()
returns void
language plpgsql
security definer
set search_path = public, extensions, net, vault
as $$
declare
    segredo text;
    base    text;
begin
    select decrypted_secret into segredo
      from vault.decrypted_secrets
     where name = 'cron_secret';

    -- Sem segredo a rota recusaria com 401 de qualquer jeito. Falhar alto
    -- aqui é melhor que disparar para tomar 401 em silêncio: o `raise`
    -- marca a passada como falha em `cron.job_run_details`, que é onde se
    -- olha quando a publicação não sai.
    if segredo is null or btrim(segredo) = '' then
        raise exception
            'cron_secret ausente no Vault. Cadastre-o antes de agendar — o comando está no cabeçalho desta migração.';
    end if;

    -- A URL também vem do Vault quando existe, para o ambiente de teste não
    -- precisar de outra migração. Sem ela, o domínio de produção.
    select decrypted_secret into base
      from vault.decrypted_secrets
     where name = 'app_url';

    base := coalesce(nullif(btrim(base), ''), 'https://app.orquesia.com.br');

    -- `net.http_get` é assíncrono: enfileira e volta na hora. A resposta cai
    -- em `net._http_response` — a passada do cron não fica presa esperando
    -- os 45s de orçamento que a função serverless usa.
    perform net.http_get(
        url     := rtrim(base, '/') || '/api/publicar',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo),
        timeout_milliseconds := 55000
    );
end;
$$;

-- A função lê o Vault, que é justamente o que sessão nenhuma pode fazer.
-- Só o agendador a chama, e ele roda como `postgres`.
revoke all on function private.disparar_publicador() from public;
revoke all on function private.disparar_publicador() from anon, authenticated;

-- ---------------------------------------------------------------------
-- O agendamento em si.
--
-- `unschedule` antes de `schedule` porque `cron.schedule` com nome repetido
-- atualiza em algumas versões e duplica em outras. Remover primeiro dá o
-- mesmo resultado em todas.
-- ---------------------------------------------------------------------

do $$
begin
    if exists (select 1 from cron.job where jobname = 'publicar-fila') then
        perform cron.unschedule('publicar-fila');
    end if;
end $$;

select cron.schedule(
    'publicar-fila',
    '*/5 * * * *',
    $agendado$ select private.disparar_publicador(); $agendado$
);

-- ---------------------------------------------------------------------
-- Como conferir que está vivo (SQL Editor):
--
--   -- as últimas passadas do agendador, com falha e mensagem
--   select start_time, status, return_message
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'publicar-fila')
--    order by start_time desc
--    limit 20;
--
--   -- o que a rota respondeu de fato
--   select created, status_code, content::text
--     from net._http_response
--    order by created desc
--    limit 20;
--
-- `status_code` 200 é passada boa. 401 significa que o valor no Vault e o
-- da Vercel divergiram — é o mesmo sintoma que o workflow tinha.
-- ---------------------------------------------------------------------

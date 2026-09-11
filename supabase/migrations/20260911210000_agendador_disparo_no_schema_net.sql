-- =====================================================================
-- O disparo do agendador, no schema onde a função mora de verdade.
--
-- Esta migração existe **porque corrigir o arquivo anterior não basta**, e
-- essa é a parte que não é óbvia.
--
-- `20260911200000_agendador_no_banco.sql` foi corrigido no lugar: ele
-- chamava `extensions.net.http_get(...)`, que não é schema errado — é nome
-- de três partes, lido pelo Postgres como *banco*.*schema*.*função* e
-- recusado com `0A000: cross-database references are not implemented`. As
-- funções do pg_net moram em `net`; `with schema extensions` registra a
-- extensão e não move nada.
--
-- Só que **quem já aplicou aquele arquivo não o aplica de novo**: o
-- histórico marca aquela versão como concluída, e a correção feita dentro
-- dela nunca roda. O banco continua com a função quebrada, e o sintoma é o
-- pior possível — toda publicação agendada falha, em silêncio, numa linha de
-- `cron.job_run_details` que ninguém abre. O arquivo antigo segue corrigido
-- para instalação nova; a correção para quem já aplicou é esta, aqui, com
-- versão própria.
--
-- Foi exatamente o que aconteceu no banco de produção: `agendador_no_banco`
-- entrou às 16:24 e falhou na primeira passada; a correção entrou às 16:25
-- como migração separada, e as passadas seguintes responderam 200. Este
-- arquivo é essa segunda migração, que até agora só existia no banco.
--
-- Repetível de propósito (`create or replace`): o banco é compartilhado
-- entre as duas máquinas e é o de produção, então aplicar de novo — de
-- qualquer lado, em qualquer ordem — não pode quebrar nada.
--
-- Protegido por `tests/agendador.test.ts`, que reprova `extensions.net.x`
-- em qualquer migração e exige `net` no `search_path` do disparo.
-- =====================================================================

create or replace function private.disparar_publicador()
returns void
language plpgsql
security definer
-- `net` precisa estar aqui: a função é `security definer` com caminho fixo,
-- então o schema não entra por herança da sessão.
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
            'cron_secret ausente no Vault. Cadastre-o antes de agendar — o comando está no cabeçalho de 20260911200000_agendador_no_banco.sql.';
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
-- O agendamento em si não é recriado aqui de propósito: ele continua sendo
-- o de `20260911200000`, e `cron.schedule` guarda o *comando*
-- (`select private.disparar_publicador()`), não o corpo da função. Trocar a
-- função basta — e recriar o agendamento correria o risco de duplicá-lo em
-- versões do pg_cron que não substituem por nome.
--
-- Para conferir que o conserto pegou:
--
--   select start_time, status, return_message
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'publicar-fila')
--    order by start_time desc limit 5;
--
-- `succeeded` na passada seguinte, e `status_code` 200 em
-- `net._http_response`, é o par que prova que está vivo.
-- ---------------------------------------------------------------------

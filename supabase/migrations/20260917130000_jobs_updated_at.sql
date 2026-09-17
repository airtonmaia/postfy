-- `jobs` não sabia quando mudou.
--
-- A tela de edição mostra "última atualização", e até aqui não havia coluna
-- para isso: só `created_at`. Mostrar a data de criação com o rótulo de
-- atualização seria a armadilha 9 num lugar barato de errar e caro de
-- descobrir — a agência olha esse campo justamente para saber se a peça mudou
-- depois de o cliente ter visto.
--
-- **Quem carimba é o banco, não o app.** A persistência derivada de diff manda
-- `update` de muitos lugares (`setAllJobs(prev => ...)`, o portal por RPC, o
-- cron de publicação com a chave de serviço): pôr `updated_at` em cada um
-- garantiria esquecer algum, e esquecer aqui não quebra nada visível — mostra
-- uma data velha com cara de certa. O gatilho não tem como ser esquecido.
--
-- Repetível, como toda migração do projeto: o banco é compartilhado entre as
-- duas máquinas e pode ser aplicada de novo sem quebrar nada.

alter table public.jobs
    add column if not exists updated_at timestamptz;

-- Linha que já existia não foi atualizada agora: ela vale o que valia.
-- Sem isto, `default now()` carimbaria **todo** o acervo com a data do deploy,
-- e no primeiro dia a tela diria que 5.000 conteúdos mudaram no mesmo minuto.
update public.jobs set updated_at = created_at where updated_at is null;

alter table public.jobs
    alter column updated_at set default now();

alter table public.jobs
    alter column updated_at set not null;

create or replace function private.carimbar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists jobs_carimbar_atualizacao on public.jobs;

create trigger jobs_carimbar_atualizacao
    before update on public.jobs
    for each row
    execute function private.carimbar_atualizacao();

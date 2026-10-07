-- =====================================================================
-- Cinco entregas a mais: branding, apresentação, foto, landing e e-mail.
--
-- `jobs.tipo` nasceu com três valores — conteudo, copy, roteiro —, e eles
-- descrevem o que uma agência de social media entrega. Agência de conteúdo
-- entrega mais que isso: o manual de marca, o deck do cliente, a seleção do
-- ensaio, o layout da página, o e-mail antes do disparo. Cada um vai para o
-- mesmo lugar — a aprovação do cliente — e nenhum cabia na lista.
--
-- **Esta migração é a metade do banco de uma decisão que tem duas.** A outra
-- é `TIPOS_DE_JOB`, em `src/lib/tiposDeJob.ts`, e a união `JobTipo`. Divergir
-- aqui não quebra nada até alguém escolher o valor novo: a persistência roda
-- em segundo plano, o Postgres recusa a linha com `23514` e a tela já pintou o
-- card. Foi exatamente assim que o formato `feed_story` custou dez conteúdos
-- perdidos em silêncio.
--
-- `tests/formato-no-banco.test.ts` deriva as duas listas e exige que esta
-- aceite aquela — é a guarda que existe para esta classe de bug.
--
-- Recriar o `check` é **reescrever a lista inteira**, e esquecer um valor que
-- já está gravado é pior que esquecer o novo: o `add constraint` valida as
-- linhas existentes, então a migração falharia na primeira agência que já usou
-- copy ou roteiro. Os três originais estão aqui.
-- =====================================================================

alter table public.jobs
    drop constraint if exists jobs_tipo_valido;

alter table public.jobs
    add constraint jobs_tipo_valido
    check (tipo in (
        'conteudo',
        'copy',
        'roteiro',
        'branding',
        'apresentacao',
        'foto',
        'landing',
        'email'
    ));

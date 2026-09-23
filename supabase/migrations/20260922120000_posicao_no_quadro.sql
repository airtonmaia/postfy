-- =====================================================================
-- `jobs.posicao_fixa`: o lugar em que alguém arrastou o card.
--
-- O quadro nunca ordenou nada. `filteredJobs` não tinha um `.sort()`, então a
-- ordem de cada coluna era a da carga do banco — que ninguém escolheu, que
-- muda quando a consulta muda, e que *parecia* ser por data. Acidente com
-- cara de regra é a pior espécie: as pessoas passam a contar com ele.
--
-- Agora a ordem é explícita (data, do mais próximo para o mais distante) e
-- esta coluna é a exceção: **o card arrastado segura o índice, e o resto flui
-- por data em volta dele.**
--
-- Três decisões:
--
-- * **`null` é o normal, não a ausência de valor.** Só tem número o card em
--   que alguém tomou uma decisão. Um `default 0` faria o acervo inteiro
--   nascer fixado no topo — e o quadro pararia de se reorganizar sem ninguém
--   ter pedido. É o oposto do `update ... where updated_at is null` que a
--   migração de `jobs.updated_at` precisou: lá o vazio era erro, aqui é o
--   estado certo.
--
-- * **O índice é por coluna, e é inteiro.** Ele é a posição na lista que a
--   pessoa está vendo. Índice fracionário resolveria a inserção entre dois
--   vizinhos sem reescrever ninguém, e não é o que está em jogo: aqui só um
--   card por vez recebe posição, e quem move entre colunas refixa no índice
--   novo em vez de carregar o antigo para uma lista de outro tamanho.
--
-- * **Sem `check` de intervalo.** Uma coluna encolhe quando os cards mudam de
--   etapa, então um índice válido hoje fica maior que a lista amanhã — sem
--   ninguém editar nada. Quem trata isso é a ordenação, que joga o excedente
--   para o fim; um `check` transformaria uma situação normal em erro de
--   gravação, e a gravação aqui roda em segundo plano, onde erro não aparece.
-- =====================================================================

alter table public.jobs
    add column if not exists posicao_fixa integer;

comment on column public.jobs.posicao_fixa is
    'Índice em que o card foi fixado dentro da coluna do quadro. NULL = flui pela ordem escolhida (padrão: data).';

-- O fluxo de produção da agência: nome, cor e prazo de cada etapa.
--
-- As sete etapas sempre foram fixas no código — "Ideias", "Produção",
-- "Aprovação"… — e agência nenhuma chama as coisas assim. Quem trabalha com
-- vídeo tem "Captação" e "Edição" onde está escrito "Produção"; quem trabalha
-- com tráfego tem "Briefing" onde está "Ideias".
--
-- ---------------------------------------------------------------------
-- O que esta coluna **não** faz, e por quê
-- ---------------------------------------------------------------------
--
-- Ela não acrescenta nem remove etapas. `jobs.status` tem um `check` com os
-- sete valores, e esse `check` é a metade do banco de uma decisão que a tela
-- também carrega — a armadilha que o `feed_story` já custou: a tela ofereceu
-- um valor que o banco recusava, a gravação roda em segundo plano, e **dez
-- conteúdos foram perdidos em silêncio** enquanto o histórico de atividade
-- dizia que tinham sido criados.
--
-- Etapa nova não é um nome a mais numa lista: ela precisa de valor no `check`,
-- de coluna no quadro, de lugar no publicador e no fluxo de aprovação. O que
-- muda aqui é como as sete **se chamam e se parecem**, que é o que resolve o
-- problema real sem abrir aquele buraco.
--
-- ---------------------------------------------------------------------
-- Por que jsonb numa coluna, e não uma tabela
-- ---------------------------------------------------------------------
--
-- São no máximo sete linhas por agência, lidas em **toda** pintura do quadro,
-- do card e do histórico. Uma tabela viraria mais uma coleção na carga
-- inicial e na persistência por diff para guardar o que cabe num campo — e o
-- diff já é a camada que este projeto registra como a que some com dado em
-- silêncio.
--
-- O formato é `{ "<status>": { "rotulo": "...", "cor": "...", "slaDias": 2 } }`,
-- com **todas as chaves opcionais**: o que não estiver ali cai no padrão do
-- código. Guardar as sete etapas inteiras faria uma agência que nunca abriu a
-- tela congelar os nomes de hoje, e a próxima renomeação do produto não
-- chegaria nela.
--
-- Sem `check` no conteúdo do jsonb, e isto é deliberado: quem valida é
-- `sanearFluxo`, no cliente, que **descarta** o que não reconhece em vez de
-- recusar a linha inteira. Um `check` aqui faria uma chave desconhecida
-- derrubar a gravação das configurações inteiras, que é a troca errada para
-- um campo de aparência.
--
-- Repetível, como toda migração do projeto: o banco é compartilhado entre as
-- duas máquinas e é produção.

alter table public.workspaces
    add column if not exists fluxo_de_producao jsonb;

comment on column public.workspaces.fluxo_de_producao is
    'Ajustes por etapa: rotulo, cor e slaDias. Chave ausente cai no padrao do codigo.';

-- Quantos dias uma peça publicada continua no quadro antes de sair da vista.
--
-- Nulo é "nunca arquivar", e é o padrão **de propósito**: a coluna "Publicado"
-- de uma agência em uso cresce para sempre, mas sumir com trabalho entregue
-- sem alguém ter pedido é pior que uma coluna longa. Quem quiser a limpeza
-- liga; quem não mexer continua vendo tudo.
--
-- Zero também vale como "nunca", e não como "arquivar na hora": um campo
-- numérico zerado por engano apagaria a coluna inteira da vista, e o estado
-- seguinte seria a pessoa concluindo que o sistema perdeu as publicações.
alter table public.workspaces
    add column if not exists arquivar_publicados_apos_dias integer;

comment on column public.workspaces.arquivar_publicados_apos_dias is
    'Dias que a peca publicada fica no quadro. Nulo ou zero = nunca arquivar.';

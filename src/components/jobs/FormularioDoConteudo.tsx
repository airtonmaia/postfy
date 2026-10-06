import React, { useEffect, useRef } from 'react';
import {
  Instagram, Facebook, Linkedin, Youtube, Twitter, Music2, ChevronDown, AlertTriangle,
} from 'lucide-react';
import type {
  Client, JobPlatform, JobFormat, JobPriority, User,
} from '../../types';
import { ResponsaveisDaPeca } from './ResponsaveisDaPeca';
import { MediaUploader } from '../common/MediaUploader';
import { CampoDinamico } from '../common/CampoDinamico';
import { AtalhosDoConteudo } from '../common/AtalhosDoConteudo';
import { BarraDeTexto } from '../common/BarraDeTexto';
import {
  camposVisiveis,
  limiteMaisApertado,
  type CampoDoCanal,
} from '../../lib/camposDoCanal';
import { formatosComuns } from '../../lib/formatos';
import type { DefinicaoDeTipo } from '../../lib/tiposDeJob';
import { fusoDoDispositivoDivergente, cidadeDoFuso, deParedeParaUtc } from '../../lib/fusoHorario';
import { dataJaPassou } from '../../lib/avisosDaPeca';
import { publicaSozinho, COMO_PUBLICA, REDES_QUE_PUBLICAM } from '../../lib/redes';
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsBadge } from '../ui/tabs';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '../ui/accordion';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';

/**
 * O formulário do conteúdo — **um só, para cadastrar e para editar.**
 *
 * Ele nasceu dentro de `CreateJobModal`, e a modal de detalhe montava a
 * própria versão: cliente e canais não dava para trocar depois de criado, a
 * arte do story não tinha campo, os campos da rede (localização, primeiro
 * comentário, capa do Reel) não existiam, o contador de caracteres não
 * contava e a prévia não abria. Quem criava no desktop e corrigia no celular
 * encontrava uma tela com metade do que tinha usado meia hora antes.
 *
 * Duas cópias do mesmo formulário divergem na primeira pressa — é a história
 * das doze alturas de botão, das sete barras de abas e da tabela de formatos
 * que já teve de sair da `CreateJobModal` por este motivo. Aqui o custo de
 * divergir é maior que o de repetir classe: **campo que existe num lado e não
 * no outro não dá erro em lugar nenhum** — a pessoa simplesmente não consegue
 * corrigir o que preencheu.
 *
 * O componente é **controlado e não grava nada**. Quem decide o que fazer com
 * o valor é a tela: o cadastro monta um job novo no botão, o editor guarda o
 * rascunho e grava no "Salvar". Um `updateJob` aqui dentro publicaria a
 * legenda pela metade a cada tecla.
 */

/**
 * Os canais, na ordem em que aparecem.
 *
 * `cor` é a cor de marca de cada rede: é ela que faz o ícone ser reconhecido
 * de relance, sem precisar ler nada. Quando o canal está escolhido, o botão
 * inverte — fundo da marca, ícone branco.
 */
const CANAIS: {
  valor: JobPlatform;
  rotulo: string;
  icone: React.FC<{ className?: string }>;
  cor: string;
  fundo: string;
}[] = [
  { valor: 'instagram', rotulo: 'Instagram', icone: Instagram, cor: 'text-[#E4405F]', fundo: 'bg-[#E4405F]' },
  { valor: 'facebook', rotulo: 'Facebook', icone: Facebook, cor: 'text-[#1877F2]', fundo: 'bg-[#1877F2]' },
  { valor: 'linkedin', rotulo: 'LinkedIn', icone: Linkedin, cor: 'text-[#0A66C2]', fundo: 'bg-[#0A66C2]' },
  { valor: 'tiktok', rotulo: 'TikTok', icone: Music2, cor: 'text-[#010101] dark:text-white', fundo: 'bg-[#010101]' },
  { valor: 'youtube', rotulo: 'YouTube', icone: Youtube, cor: 'text-[#FF0000]', fundo: 'bg-[#FF0000]' },
  { valor: 'twitter', rotulo: 'X / Twitter', icone: Twitter, cor: 'text-[#0F1419] dark:text-white', fundo: 'bg-[#0F1419]' },
];

/**
 * As outras origens da arte, no menu do botão "Adicionar mídia".
 *
 * Fora do componente porque são **dois** uploaders (feed e story), e duas
 * cópias da mesma lista divergem na primeira vez que alguém acrescentar uma
 * integração num só.
 */
/*
  O Google Drive **saiu desta lista** e mora dentro do `MediaUploader`: a
  escolha mexe em `onChange`, que é dele, e são dois uploaders por peça (feed
  e story). Numa lista de fora, cada tela reescreveria o mesmo handler — e é
  assim que um dos dois fica para trás.
*/
const ORIGENS_DE_MIDIA = [
  { rotulo: 'Canva', disponivel: false },
  { rotulo: 'Dropbox', disponivel: false },
];

/**
 * O conteúdo como o formulário o vê.
 *
 * As duas datas são **hora de parede no fuso da agência**, no formato do
 * `datetime-local` — não ISO. A conversão mora nas pontas (`deParedeParaUtc`
 * ao salvar, `deUtcParaParede` ao abrir), porque é lá que existe o valor do
 * banco; guardar ISO aqui faria o campo interpretar no fuso do aparelho, que
 * é exatamente a armadilha 8.2.
 */
/**
 * "Esta data já passou" embaixo do campo.
 *
 * **Hora de parede, convertida pelo fuso da agência antes de comparar.** O
 * `datetime-local` entrega "2026-10-08T10:00" sem fuso nenhum, e `new Date`
 * o interpreta no fuso do **navegador**: quem agenda de São Paulo para uma
 * agência de Cuiabá veria o aviso aparecer e sumir com uma hora de erro
 * (armadilha 8.2).
 *
 * E ele **não aparece na peça publicada**: ali a data no passado é o normal, e
 * um alerta em toda peça antiga é como se aprende a ignorar os alertas.
 */
const AvisoDeAtraso: React.FC<{ quando: string; avisar: boolean }> = ({ quando, avisar }) => {
  if (!avisar || !dataJaPassou(deParedeParaUtc(quando))) return null;

  return (
    <span className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-3 h-3 shrink-0" />
      Esta data já passou
    </span>
  );
};

/**
 * Os pedaços em que o formulário pode ser recortado.
 *
 * São quatro porque são quatro perguntas diferentes: *de quem é e o que é*,
 * *qual a arte*, *o que ela diz* e *quando sai*. O assistente do celular dá um
 * passo a cada um; a tela de computador junta arte e texto de um lado e os
 * outros dois do outro.
 */
export type BlocoDoFormulario = 'identificacao' | 'arte' | 'texto' | 'agenda';

export const TODOS_OS_BLOCOS: BlocoDoFormulario[] = ['identificacao', 'arte', 'texto', 'agenda'];

export interface DadosDoConteudo {
  clientId: string;
  title: string;
  canais: JobPlatform[];
  format: JobFormat;
  priority: JobPriority;
  caption: string;
  draft: string;
  firstComment: string;
  configuracoes: Record<string, unknown>;
  mediaUrls: string[];
  storyMediaUrls: string[];
  scheduledDate: string;
  deadlineApproval: string;
  /** Ids de quem da equipe toca a peça. */
  responsaveis: string[];
}

interface Props {
  valor: DadosDoConteudo;
  /** Parcial: a tela junta com o que já tinha. */
  aoMudar: (parcial: Partial<DadosDoConteudo>) => void;
  tipo: DefinicaoDeTipo;
  clients: Client[];
  /** A equipe da agência, para o seletor de responsáveis. Vem da tela. */
  equipe: User[];
  /**
   * A IA precisa do tema, que é o título — sem ele a rota recusa. Quem monta
   * a chamada é a tela, que é quem tem o `generateAiCopy` do contexto.
   */
  aoGerarComIA?: () => Promise<string>;
  /**
   * O prazo de aprovação só aparece na edição.
   *
   * No cadastro ele é **derivado** da data de publicação (um dia antes), e
   * pedir os dois antes de o conteúdo existir era decisão a mais num
   * formulário que já tem doze campos. Depois de criado ele é dado real, que
   * a agência combina com o cliente — e até agora não havia onde mexer nele
   * sem abrir outra tela.
   */
  mostrarDeadline?: boolean;
  /**
   * Mostrar "esta data já passou" embaixo dos campos de data.
   *
   * Quem decide é a tela, porque é ela que conhece o status: na peça
   * **publicada** a data no passado é o estado normal, e alertar ali é o
   * caminho para a pessoa parar de ler os alertas.
   */
  avisarAtraso?: boolean;
  /**
   * Quais blocos desenhar, e em que ordem a tela os pediu.
   *
   * **O formulário é um só, montado mais de uma vez com recortes diferentes.**
   * A tela de conteúdo o parte em duas colunas; o assistente do celular o
   * parte em quatro passos. A alternativa — escrever os campos de novo em
   * cada lugar — daria três definições do mesmo formulário, e duas cópias
   * divergem na primeira pressa: é a história das doze alturas de botão, das
   * sete barras de abas e da tabela de formatos.
   *
   * Divergir **aqui** é pior que nos outros casos: um campo some de um
   * recorte e ninguém nota, porque os outros continuam mostrando o deles.
   *
   * A consequência que precisa de cuidado está no efeito que revalida o
   * formato ao trocar de canal: ele mora no bloco que tem o campo Formato, e
   * **só nele**. Em duas montagens ele rodaria duas vezes — aqui seria
   * inofensivo, porque as duas gravariam o mesmo valor, mas "inofensivo por
   * coincidência" é como um efeito duplicado passa a ser aceito num lugar
   * onde ele não é.
   */
  blocos?: BlocoDoFormulario[];
  /**
   * Esconde o campo Título — para a tela que já edita o título em outro lugar.
   *
   * É o caso da tela de conteúdo, onde ele é editado no próprio cabeçalho, em
   * cima: dois campos para o mesmo valor na mesma tela deixam a pergunta de
   * qual dos dois vale. O padrão é mostrá-lo, porque o cadastro não tem
   * cabeçalho com a peça — e sem título a peça nasceria sem nome.
   */
  semTitulo?: boolean;
  /**
   * O que entra em "Mais opções", embaixo do formulário.
   *
   * É um espaço, não uma lista: o cadastro não põe nada ali (CTA, hashtags e
   * campanha saíram dele de propósito — enchiam a tela de campo que quase
   * ninguém preenchia na criação), e o editor põe o que só existe depois de a
   * peça existir. Sem filhos a seção não é desenhada.
   */
  children?: React.ReactNode;
}

export const FormularioDoConteudo: React.FC<Props> = ({
  valor,
  aoMudar,
  tipo,
  clients,
  equipe,
  aoGerarComIA,
  mostrarDeadline = false,
  avisarAtraso = true,
  blocos = TODOS_OS_BLOCOS,
  semTitulo = false,
  children,
}) => {
  const {
    clientId, title, canais, format, priority,
    caption, draft, firstComment, configuracoes,
    mediaUrls, storyMediaUrls, scheduledDate, deadlineApproval, responsaveis,
  } = valor;

  const mostrar = (b: BlocoDoFormulario) => blocos.includes(b);

  const identificacao = mostrar('identificacao');
  const arte = mostrar('arte');
  const texto = mostrar('texto');
  const agenda = mostrar('agenda');

  /* O efeito que revalida o formato acompanha o campo Formato. */
  const gestao = identificacao;

  const platform = canais[0] || 'instagram';

  // O campo de copy e roteiro é desenhado aqui, e não pelo catálogo da rede,
  // então a barra precisa da referência dele para escrever no cursor.
  const areaDoTexto = useRef<HTMLTextAreaElement>(null);

  const [abaDoTexto, setAbaDoTexto] = React.useState<'legenda' | 'rascunho'>('legenda');

  const formatosDoCanal = formatosComuns(canais);

  /**
   * Trocar de canal pode invalidar o formato escolhido — Story não existe no
   * YouTube. Sem isto o `select` ficava em branco e o job era salvo com um
   * formato que aquela rede não aceita, sem ninguém ver.
   */
  useEffect(() => {
    /*
      **Só a metade que desenha o campo Formato revalida o formato.** Com o
      formulário partido em duas colunas, o componente é montado duas vezes; sem
      esta saída, o efeito rodaria nas duas. As duas gravariam o mesmo valor —
      inofensivo por coincidência, e é assim que um efeito duplicado passa a ser
      aceito num lugar onde ele não é.
    */
    if (!gestao) return;
    if (formatosDoCanal.length && !formatosDoCanal.some((f) => f.valor === format)) {
      aoMudar({ format: formatosDoCanal[0].valor });
    }
    // `aoMudar` muda de identidade a cada render da tela de cima; incluí-lo
    // aqui faria o efeito rodar em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canais, format]);

  const campos = camposVisiveis(platform, format);

  // Os acessórios saem da lista e viram ícones na linha do rótulo da legenda.
  const camposEmLinha = campos.filter((c) => !c.atalho);
  const camposEmAtalho = campos.filter((c) => c.atalho);

  /**
   * O limite vem da rede mais apertada entre as escolhidas, não da principal.
   * Com Instagram e X marcados juntos, quem corta é o X.
   */
  const limite = limiteMaisApertado(canais);
  const nomeDoCanal = (canal: JobPlatform) =>
    CANAIS.find((c) => c.valor === canal)?.rotulo || canal;

  /**
   * Os canais escolhidos, **na ordem da lista** e não na de clique.
   *
   * `canais.map(...)` seguiria a ordem em que a pessoa marcou, e o gatilho
   * mudaria de texto ao desmarcar e remarcar a mesma rede — um rótulo que se
   * reordena sozinho parece que mudou de valor.
   */
  const escolhidos = CANAIS.filter((c) => canais.includes(c.valor));

  /** Clicar num canal liga ou desliga. Nunca deixa a seleção vazia. */
  const alternarCanal = (canal: JobPlatform) => {
    if (canais.includes(canal)) {
      const resto = canais.filter((c) => c !== canal);
      if (resto.length) aoMudar({ canais: resto });
      return;
    }
    aoMudar({ canais: [...canais, canal] });
  };

  /**
   * Legenda e primeiro comentário têm coluna própria e continuam nela; o
   * resto vive no `jsonb`. Ler e escrever pelo catálogo evita a tela precisar
   * saber onde cada campo mora.
   */
  const valorDoCampo = (campo: CampoDoCanal): unknown => {
    if (campo.destino === 'config') return configuracoes[campo.chave];
    if (campo.chave === 'caption') return caption;
    if (campo.chave === 'firstComment') return firstComment;
    return '';
  };

  const definirCampo = (campo: CampoDoCanal, v: unknown) => {
    if (campo.destino === 'config') {
      aoMudar({ configuracoes: { ...configuracoes, [campo.chave]: v } });
      return;
    }
    if (campo.chave === 'caption') aoMudar({ caption: String(v ?? '') });
    if (campo.chave === 'firstComment') aoMudar({ firstComment: String(v ?? '') });
  };

  const classeDeEntrada =
    'w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white';

  const rotulo = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-4">
      {identificacao && (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cliente */}
        <div>
          <label className={rotulo}>Cliente *</label>
          <select
            value={clientId}
            onChange={(e) => aoMudar({ clientId: e.target.value })}
            className={`${classeDeEntrada} cursor-pointer`}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/*
          **Canais é um select de múltipla escolha, como o "Compartilhar em"
          da Meta.**

          Era uma fileira de seis ícones que ligam e desligam. Funcionava e
          tinha dois problemas que só aparecem em uso: o estado desligado era
          a mesma logo com opacidade — "apagado" e "aceso" ficam parecidos num
          olhar rápido, e ninguém conta seis ícones para saber o que está
          escolhido —, e a fileira não diz **quantos**. O gatilho do menu diz,
          em texto, antes de abrir qualquer coisa.

          O `DropdownMenu` e não um `<select multiple>`: o nativo abre uma
          caixa com a fonte e o cinza do sistema operacional, sem logo nenhuma,
          e o produto é whitelabel — "a cara do navegador" é justamente o que
          ele existe para não mostrar. Em `multiple` o nativo ainda exige
          Ctrl+clique no computador, que é a interação que mais gente erra.
        */}
        <div>
          <label className={rotulo}>Canais *</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${classeDeEntrada} flex items-center gap-2 text-left cursor-pointer`}
              >
                <span className="flex -space-x-1.5 shrink-0">
                  {escolhidos.map((canal) => {
                    const Icone = canal.icone;
                    return (
                      <span
                        key={canal.valor}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white ring-2 ring-slate-50 dark:ring-slate-950 ${canal.fundo}`}
                      >
                        <Icone className="w-3 h-3" />
                      </span>
                    );
                  })}
                </span>
                <span className="flex-1 min-w-0 truncate font-semibold">
                  {escolhidos.map((c) => c.rotulo).join(' e ')}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
              </button>
            </DropdownMenuTrigger>

            {/* `--radix-dropdown-menu-trigger-width`: o menu tem a largura do
                campo, como todo seletor. Solto, ele encolhia para o texto e
                ficava mais estreito que o gatilho. */}
            <DropdownMenuContent
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width)"
            >
              <DropdownMenuLabel>Publicar em</DropdownMenuLabel>
              {CANAIS.map((canal) => {
                const Icone = canal.icone;
                const ativo = canais.includes(canal.valor);
                return (
                  <DropdownMenuCheckboxItem
                    key={canal.valor}
                    checked={ativo}
                    /* O Radix fecha o menu a cada escolha por padrão, e aqui
                       a escolha é múltipla: fechar obrigaria a reabrir para
                       marcar a segunda rede. */
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => alternarCanal(canal.valor)}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        ativo ? `${canal.fundo} text-white` : `bg-slate-100 dark:bg-slate-800 ${canal.cor}`
                      }`}
                    >
                      <Icone className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-slate-800 dark:text-slate-200">
                        {canal.rotulo}
                      </span>
                      {/* Quem publica e quem não publica, na hora da escolha.
                          Descobrir na data agendada é tarde: o cliente aprovou
                          e a peça não foi ao ar. */}
                      <span className="block text-[10px] text-slate-400 leading-tight">
                        {COMO_PUBLICA[canal.valor]}
                      </span>
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/*
            Quem marca LinkedIn precisa saber, aqui, que ninguém vai publicar
            por ele. Descobrir isso na data agendada é tarde: o cliente
            aprovou e a peça não foi ao ar.
          */}
          {canais.some((c) => !publicaSozinho(c)) && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-relaxed">
              {canais.filter((c) => !publicaSozinho(c)).join(', ')}:{' '}
              <strong>você publica</strong> na data. O disparo automático hoje é só{' '}
              {REDES_QUE_PUBLICAM.join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/*
        **O título só existe aqui onde não há outro editor dele.**

        A tela de conteúdo edita o título no próprio cabeçalho, que é onde ele
        é lido; repeti-lo na coluna de gestão deixava a pergunta "qual dos dois
        vale", e um campo para o mesmo valor em dois lugares da mesma tela é
        como alguém edita um e conclui que o outro não salvou. O cadastro não
        tem cabeçalho com a peça, então lá ele continua sendo este campo.
      */}
      {!semTitulo && (
        <div>
          <label className={rotulo}>Título do conteúdo *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => aoMudar({ title: e.target.value })}
            placeholder="Ex: 5 Dicas para Escolher o Melhor Café Especial"
            className={`${classeDeEntrada} font-semibold`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/*
          **Formato e prioridade dividem a linha**, e os dois são seletores
          curtos: sozinho, cada um deixava metade da linha vazia numa coluna
          que é estreita justamente para a arte caber ao lado. Quem está na
          peça desceu porque é o único dos três que cresce — cada pessoa
          atribuída é um chip, e com três ele já ocupa duas linhas.
        */}
        <div>
          <label className={rotulo}>Formato</label>
          <select
            value={format}
            onChange={(e) => aoMudar({ format: e.target.value as JobFormat })}
            className={`${classeDeEntrada} cursor-pointer`}
          >
            {formatosDoCanal.map((f) => (
              <option key={f.valor} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo}>Prioridade</label>
          <select
            value={priority}
            onChange={(e) => aoMudar({ priority: e.target.value as JobPriority })}
            className={`${classeDeEntrada} cursor-pointer`}
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>

        {/* Quem está na peça.

            **Fica no formulário, e não na coluna de metadados onde o campo
            mentiroso estava.** Metadado é o que a tela sabe e não se edita; a
            atribuição é decisão, e decisão mora onde se decide. Assim ela
            também passa a existir no cadastro — atribuir na criação é o
            momento em que a agência de fato distribui o trabalho. */}
        <div className="sm:col-span-2">
          <label className={rotulo}>Quem está nesta peça</label>
          <ResponsaveisDaPeca
            valor={responsaveis}
            equipe={equipe}
            aoMudar={(ids) => aoMudar({ responsaveis: ids })}
          />
        </div>
      </div>

      </>
      )}

      {(arte || texto) && (
      <>
      {/*
        **A arte e o texto ficam lado a lado a partir do lg.**

        Eram empilhados, e o custo era de rolagem: a legenda ficava uma tela
        inteira abaixo da arte, então escrever olhando para a imagem — que é
        como se escreve legenda — exigia subir e descer a cada frase. Lado a
        lado, os dois cabem na mesma dobra num notebook.

        No celular continuam empilhados: 390px não comportam duas colunas, e
        espremer a área de texto é pior que rolar. E sem arte (copy e roteiro)
        o texto ocupa a largura inteira, em vez de deixar meia tela vazia.
      */}
      {/* O lado a lado só existe quando os **dois** estão na mesma tela: no
          assistente do celular cada um tem o passo dele, e aí a grade de duas
          colunas deixaria metade vazia. */}
      {/* A divisão é 2/5 para a arte e 3/5 para o texto, e não meio a meio:
          a arte é um quadrado com miniaturas de largura fixa, e o que sobrava
          dela virava espaço vazio enquanto a legenda — que é texto corrido e
          tem contador — quebrava mais cedo do que precisava. */}
      <div className={tipo.pedeArte && arte && texto ? 'grid grid-cols-1 lg:grid-cols-5 gap-5 lg:items-start' : ''}>
      {/* Só quem tem arte pede arte. Copy e roteiro são texto: oferecer
          upload neles seria pedir aprovação de algo que não existe. */}
      {tipo.pedeArte && arte && (
        <div className="pt-1 space-y-5 lg:col-span-2">
          <MediaUploader
            mediaUrls={mediaUrls}
            onChange={(urls) => aoMudar({ mediaUrls: urls })}
            maxFiles={10}
            label={format === 'feed_story' ? 'Mídia do Feed' : 'Mídia e criativos'}
            helperText={
              format === 'feed_story'
                ? 'A arte que vai no feed, em 4:5. Para carrossel, você pode reordenar as páginas.'
                : undefined
            }
            /* Buscar a arte de onde ela já está é o próximo passo; hoje não
               existe. Entram no menu desligadas, dizendo "em breve". */
            origens={ORIGENS_DE_MIDIA}
          />

          {/*
            **Dois campos, porque são duas artes.**

            O feed é 4:5 e o story é 9:16: a mesma imagem nos dois sai cortada
            num deles. Um campo só obrigaria a agência a escolher qual dos dois
            sai errado — e o story é justamente o formato em que a peça precisa
            ser vertical.
          */}
          {format === 'feed_story' && (
            <MediaUploader
              mediaUrls={storyMediaUrls}
              onChange={(urls) => aoMudar({ storyMediaUrls: urls })}
              maxFiles={1}
              label="Mídia do Story"
              helperText="A arte vertical, em 9:16. Sai no story na mesma data do feed."
              origens={ORIGENS_DE_MIDIA}
            />
          )}
        </div>
      )}

      {/*
        O texto do conteúdo tem dois lados, e **só um deles é publicado.**

        "Legenda" é o que vai para a rede: conta contra o limite de caracteres,
        aparece na prévia e é o que a Meta recebe. "Rascunho" é o texto de
        trabalho — versão descartada da legenda, gancho, o que o cliente falou
        na reunião.

        **Os dois campos existem sempre**, e quem escolhe a aba não muda o que
        é salvo. Guardar os dois no mesmo campo significaria publicar o
        rascunho junto na primeira vez que alguém esquecesse de apagar — e o
        que sai no perfil do cliente não volta.
      */}
      {texto && (
      <Tabs
        value={abaDoTexto}
        onValueChange={(v) => setAbaDoTexto(v as 'legenda' | 'rascunho')}
        className={tipo.pedeArte && arte ? 'lg:col-span-3' : undefined}
      >
        <div className="flex items-end justify-between gap-2 mb-1 min-h-[22px]">
          <TabsList aparencia="segmentado">
            <TabsTrigger value="legenda">
              {tipo.pedeArte ? 'Legenda' : tipo.rotuloDoTexto}
            </TabsTrigger>
            <TabsTrigger value="rascunho">
              Rascunho
              {/* O selo só aparece quando há texto do outro lado: sem ele, um
                  rascunho escrito some de vista ao trocar de aba e ninguém
                  lembra que ele existe. */}
              {draft.trim() !== '' && <TabsBadge>1</TabsBadge>}
            </TabsTrigger>
          </TabsList>

          {/* Os acessórios pertencem ao texto que vai publicado, então ficam
              na linha das abas e só valem para a legenda. */}
          {tipo.pedeArte && (
            <AtalhosDoConteudo
              campos={camposEmAtalho}
              valorDoCampo={valorDoCampo}
              definirCampo={definirCampo}
              legenda={caption}
              canalPrincipal={platform}
            />
          )}
        </div>

        <TabsContent value="legenda">
          {tipo.pedeArte ? (
            <div className="space-y-4">
              {camposEmLinha.map((campo) => (
                <CampoDinamico
                  key={campo.chave}
                  campo={campo}
                  valor={valorDoCampo(campo)}
                  onChange={(v) => definirCampo(campo, v)}
                  limite={limite?.limite}
                  donoDoLimite={limite ? nomeDoCanal(limite.canal) : undefined}
                  aoGerarComIA={aoGerarComIA}
                  /* O campo do texto principal perde o rótulo: quem o nomeia
                     agora é a aba, logo acima. */
                  semRotulo={campo.barra}
                />
              ))}
            </div>
          ) : (
            <div>
              <BarraDeTexto
                valor={caption}
                onChange={(v) => aoMudar({ caption: String(v) })}
                areaRef={areaDoTexto}
                /* O roteiro conta caracteres mas não tem teto: ele não é o
                   texto que vai publicado. */
                limite={tipo.respeitaLimiteDaRede ? limite?.limite : undefined}
                donoDoLimite={
                  tipo.respeitaLimiteDaRede && limite
                    ? nomeDoCanal(limite.canal)
                    : undefined
                }
                aoGerarComIA={aoGerarComIA}
              />
              <textarea
                ref={areaDoTexto}
                rows={12}
                value={caption}
                onChange={(e) => aoMudar({ caption: e.target.value })}
                placeholder={tipo.exemploDoTexto}
                className={`${classeDeEntrada} rounded-t-none leading-relaxed`}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="rascunho">
          {/*
            Sem barra de formatação e sem contador de caracteres, de propósito:
            negrito e limite da rede pertencem ao texto que vai publicado. Um
            contador aqui diria que este texto disputa o mesmo teto, que é
            justamente o que ele não faz.
          */}
          <textarea
            rows={tipo.pedeArte ? 10 : 12}
            value={draft}
            onChange={(e) => aoMudar({ draft: e.target.value })}
            placeholder="Rascunho da legenda, ideias de gancho, o que o cliente pediu na reunião. Este texto não vai publicado."
            className={`${classeDeEntrada} leading-relaxed`}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Fica só aqui dentro: não entra na publicação nem aparece na prévia.
          </p>
        </TabsContent>
      </Tabs>
      )}
      </div>

      </>
      )}

      {agenda && (
      <>
      {/* "Mais opções": só é desenhada quando a tela tem o que pôr dentro. */}
      {children && (
        <Accordion type="single" collapsible className="border-t border-slate-200 dark:border-slate-800 pt-3">
          <AccordionItem value="mais">
            <AccordionTrigger>Mais opções</AccordionTrigger>
            <AccordionContent className="space-y-4">{children}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* As datas ficam no fim, depois do texto: a decisão de quando publicar
          vem depois de a peça existir. */}
      <div className={`grid grid-cols-1 gap-3 ${mostrarDeadline ? 'sm:grid-cols-2' : 'max-w-xs'}`}>
        <div>
          <label className={rotulo}>Data e hora de publicação</label>
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => aoMudar({ scheduledDate: e.target.value })}
            className={`${classeDeEntrada} cursor-pointer`}
          />
          <AvisoDeAtraso quando={scheduledDate} avisar={avisarAtraso} />
        </div>

        {mostrarDeadline && (
          <div>
            <label className={rotulo}>Deadline de aprovação</label>
            <input
              type="datetime-local"
              value={deadlineApproval}
              onChange={(e) => aoMudar({ deadlineApproval: e.target.value })}
              className={`${classeDeEntrada} cursor-pointer`}
            />
            <AvisoDeAtraso quando={deadlineApproval} avisar={avisarAtraso} />
          </div>
        )}
      </div>

      {/* O aviso só aparece quando os dois fusos divergem. Repetir "horário de
          Cuiabá" para quem está em Cuiabá seria ruído, e ruído treina a pessoa
          a ignorar avisos — mas quem agenda de outro estado precisa saber que o
          horário não é o do relógio dele. */}
      {fusoDoDispositivoDivergente() && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 -mt-2 leading-relaxed">
          Horário de <strong>{cidadeDoFuso()}</strong>, o fuso da agência — não o do
          seu aparelho.
        </p>
      )}
      </>
      )}
    </div>
  );
};

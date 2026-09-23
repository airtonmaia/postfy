import React, { useEffect, useRef } from 'react';
import {
  Instagram, Facebook, Linkedin, Youtube, Twitter, Music2, ChevronDown,
} from 'lucide-react';
import type {
  Client, JobPlatform, JobFormat, JobPriority,
} from '../../types';
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
import { fusoDoDispositivoDivergente, cidadeDoFuso } from '../../lib/fusoHorario';
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
}

interface Props {
  valor: DadosDoConteudo;
  /** Parcial: a tela junta com o que já tinha. */
  aoMudar: (parcial: Partial<DadosDoConteudo>) => void;
  tipo: DefinicaoDeTipo;
  clients: Client[];
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
  aoGerarComIA,
  mostrarDeadline = false,
  children,
}) => {
  const {
    clientId, title, canais, format, priority,
    caption, draft, firstComment, configuracoes,
    mediaUrls, storyMediaUrls, scheduledDate, deadlineApproval,
  } = valor;

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

      {/* Título */}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Formato: só o que existe na rede escolhida. */}
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

        {/* Prioridade */}
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
      </div>

      {/* Só quem tem arte pede arte. Copy e roteiro são texto: oferecer
          upload neles seria pedir aprovação de algo que não existe. */}
      {tipo.pedeArte && (
        <div className="pt-1 space-y-5">
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
      <Tabs
        value={abaDoTexto}
        onValueChange={(v) => setAbaDoTexto(v as 'legenda' | 'rascunho')}
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
    </div>
  );
};

import React from 'react';
import { CalendarRange, Layers, Share2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { usePostfy } from '../../context/PostfyContext';
import { PERIODOS, type Periodo } from '../../lib/ordemDoQuadro';
import { FORMATOS_POR_CANAL } from '../../lib/formatos';
import { NOME_DA_REDE } from '../../lib/redes';
import type { JobPlatform } from '../../types';

/**
 * Cliente, formato, rede e janela de datas — **a mesma barra nas duas telas**.
 *
 * O quadro tinha estes controles e o calendário tinha outros, parecidos e
 * diferentes. Desde que as duas viraram visões de um menu só, isso deixou de
 * ser inconsistência de desenho e virou defeito: a pessoa filtra por Reels no
 * quadro, clica em Calendário e o filtro some — sem nada dizer que sumiu, e
 * com a tela mostrando conteúdo que ela acabou de recortar para fora.
 *
 * **Todo o estado mora no contexto**, não aqui dentro. É o que faz o filtro
 * sobreviver à troca de visão, e é a mesma decisão da faixa de clientes: dois
 * controles podem existir, dois estados para a mesma pergunta não.
 *
 * ### O que não está aqui, e por quê
 *
 * - **Ordenação.** Ela é do quadro — o calendário ordena por data, que é o
 *   eixo dele. Um controle de ordem numa grade de dias não tem o que ordenar.
 * - **Responsável.** Saiu a pedido, depois de entrar: a barra já tem quatro
 *   controles, e o quinto empurrava a troca de visão para fora da linha no
 *   notebook.
 * - **Busca.** O cabeçalho do produto tem um campo de busca fixo, que procura
 *   em jobs, clientes e leads. Um segundo campo logo abaixo, procurando menos,
 *   é a tela oferecendo duas respostas para a mesma pergunta.
 *
 * As listas são **derivadas**: formato de `FORMATOS_POR_CANAL`, rede de
 * `NOME_DA_REDE`, clientes do contexto. Lista literal numa tela de filtro é
 * pior que numa tela comum — quando ela diverge, o conteúdo some sem nada
 * dizer que sumiu.
 */

/**
 * Todos os formatos que existem, sem repetir.
 *
 * A tabela é por rede e um formato aparece em várias; o filtro pergunta "qual
 * formato", sem rede no meio.
 */
const FORMATOS = Object.values(FORMATOS_POR_CANAL)
  .flat()
  .filter((f, i, todos) => todos.findIndex((o) => o.valor === f.valor) === i);

const REDES = Object.entries(NOME_DA_REDE) as [JobPlatform, string][];

export const BarraDeFiltrosDoConteudo: React.FC = () => {
  const {
    clients,
    clientFilter,
    setClientFilter,
    platformFilter,
    setPlatformFilter,
    formatFilter,
    setFormatFilter,
    periodoFiltro,
    setPeriodoFiltro,
    intervaloFiltro,
    setIntervaloFiltro,
  } = usePostfy();

  /*
    O gatilho diz o **valor escolhido**, não o nome do filtro. Um botão
    "Formato" não distingue um quadro inteiro de um quadro recortado em Reels
    três dias atrás — e o segundo é exatamente o estado que faz a pessoa
    concluir que o conteúdo sumiu.
  */
  const rotuloDoFormato =
    formatFilter === 'todos'
      ? 'Qualquer formato'
      : (FORMATOS.find((f) => f.valor === formatFilter)?.rotulo ?? 'Qualquer formato');

  const rotuloDaRede =
    platformFilter === 'all'
      ? 'Qualquer rede'
      : (NOME_DA_REDE[platformFilter as JobPlatform] ?? 'Qualquer rede');

  const rotuloDoPeriodo =
    PERIODOS.find((p) => p.valor === periodoFiltro)?.rotulo ?? 'Qualquer data';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* O seletor de clientes é estreito de propósito: ele era o controle
          mais largo da barra e o nome do cliente já aparece na faixa de fotos
          logo abaixo, em tamanho que se lê de relance. Aqui ele é o caminho
          de quem procura pelo nome, não o lugar de exibi-lo. */}
      <select
        value={clientFilter}
        onChange={(e) => setClientFilter(e.target.value)}
        className="w-40 text-xs h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-medium"
        aria-label="Filtrar por cliente"
      >
        <option value="all">Todos os Clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={formatFilter === 'todos' ? 'secondary' : 'primary'}
            aria-label={`Formato: ${rotuloDoFormato}`}
          >
            <Layers className="w-3.5 h-3.5" />
            {rotuloDoFormato}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Formato da peça</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={formatFilter} onValueChange={setFormatFilter}>
            <DropdownMenuRadioItem value="todos">Qualquer formato</DropdownMenuRadioItem>
            {FORMATOS.map((f) => (
              <DropdownMenuRadioItem key={f.valor} value={f.valor}>
                {f.rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={platformFilter === 'all' ? 'secondary' : 'primary'}
            aria-label={`Rede: ${rotuloDaRede}`}
          >
            <Share2 className="w-3.5 h-3.5" />
            {rotuloDaRede}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Rede do conteúdo</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={platformFilter} onValueChange={setPlatformFilter}>
            <DropdownMenuRadioItem value="all">Qualquer rede</DropdownMenuRadioItem>
            {REDES.map(([valor, rotulo]) => (
              <DropdownMenuRadioItem key={valor} value={valor}>
                {rotulo}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={periodoFiltro === 'todos' ? 'secondary' : 'primary'}
            aria-label={`Período: ${rotuloDoPeriodo}`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            {rotuloDoPeriodo}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Mostrar conteúdo de</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={periodoFiltro}
            onValueChange={(v) => setPeriodoFiltro(v as Periodo)}
          >
            {PERIODOS.map((p, i) => (
              <React.Fragment key={p.valor}>
                {/* A virada entre o que já passou e o que está por vir é o
                    único corte da lista. Sem ele, "Já passou" no meio de
                    "Próximos 30 dias" obriga a ler item por item. */}
                {i > 0 && PERIODOS[i - 1].passado && !p.passado && <DropdownMenuSeparator />}
                <DropdownMenuRadioItem
                  value={p.valor}
                  descricao={
                    p.valor === 'todos' ? 'Inclusive o que ainda não tem data' : undefined
                  }
                >
                  {p.rotulo}
                </DropdownMenuRadioItem>
              </React.Fragment>
            ))}
          </DropdownMenuRadioGroup>

          {/*
            As duas pontas aparecem **só** com "personalizado" escolhido: dois
            campos de data sempre visíveis num menu de atalhos fazem parecer
            que o atalho e o intervalo somam, quando um substitui o outro.

            **`<input type="date">`, e isto é decisão de correção.** Ele
            entrega `YYYY-MM-DD` puro — um dia, não um instante —, que é o que
            `dentroDoPeriodo` compara e o que `diaNoFuso` devolve. Uma grade
            desenhada à mão teria de produzir uma `Date` e convertê-la, e é aí
            que mora a armadilha 8.2.
          */}
          {periodoFiltro === 'personalizado' && (
            <>
              <DropdownMenuSeparator />
              <div
                className="px-2 py-1.5 space-y-2"
                // O menu fecha na tecla que o item entende como escolha; o
                // campo de data precisa das setas e dos números.
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    De
                  </label>
                  <input
                    type="date"
                    value={intervaloFiltro.de ?? ''}
                    onChange={(e) =>
                      setIntervaloFiltro({ ...intervaloFiltro, de: e.target.value })
                    }
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Até
                  </label>
                  <input
                    type="date"
                    value={intervaloFiltro.ate ?? ''}
                    onChange={(e) =>
                      setIntervaloFiltro({ ...intervaloFiltro, ate: e.target.value })
                    }
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                {/* Uma ponta só é um filtro legítimo — "de março em diante" —,
                    então a tela diz o que está valendo em vez de exigir as
                    duas. Sem isso, metade preenchida parece filtro quebrado. */}
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {!intervaloFiltro.de && !intervaloFiltro.ate
                    ? 'Sem data escolhida, a tela mostra tudo.'
                    : !intervaloFiltro.de
                      ? 'Tudo até a data escolhida.'
                      : !intervaloFiltro.ate
                        ? 'Da data escolhida em diante.'
                        : 'As duas datas entram no período.'}
                </p>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

import { Button } from '../ui/button';
import { ComTooltip } from '../ui/tooltip';
import { deParedeParaUtc, deUtcParaParede } from '../../lib/fusoHorario';
import { cn } from '../../lib/utils';

/**
 * Um valor que vira campo ao ser clicado.
 *
 * A tela de detalhe do conteúdo **mostrava tudo e não editava nada**: para
 * corrigir uma vírgula na legenda era preciso abrir outra tela. Editar onde se
 * lê é o caminho curto, e é o que o documento pediu — "ao clicar no texto da
 * legenda, vira um campo de edição".
 *
 * Está aqui, e não dentro da modal, porque a mesma necessidade aparece em cada
 * campo dela: título, legenda, rascunho, data agendada, prazo, prioridade. Seis
 * cópias da mesma interação divergem na primeira pressa — foi assim que
 * nasceram as doze alturas de botão e as sete barras de abas.
 *
 * Três regras que valem para todos:
 *
 * - **Nada é salvo sem confirmação.** Sair do campo mantém o texto em edição;
 *   quem grava é o ✓ ou o `Ctrl+Enter`. Salvar no `blur` publica o rascunho de
 *   quem só clicou fora para ler outra coisa.
 * - **Esc cancela e devolve o valor original.** Sem saída, um clique errado
 *   vira uma edição que a pessoa não sabe desfazer.
 * - **O estado local nasce do valor e é reposto quando ele muda.** Um
 *   `useState(valor)` sozinho é lido só na primeira renderização: o campo
 *   ficaria com o texto velho preso depois de a peça ser salva noutro lugar —
 *   a mesma armadilha 8.1 do `WhatsAppShareModal`.
 */

type Tipo = 'texto' | 'textoLongo' | 'dataHora' | 'selecao';

interface Props {
  valor: string;
  aoSalvar: (novo: string) => void;
  tipo?: Tipo;
  /** Para `selecao`. Ignorado nos outros tipos. */
  opcoes?: { valor: string; rotulo: string }[];
  /** O que aparece quando o valor está vazio. Nunca fica em branco. */
  vazio?: string;
  placeholder?: string;
  linhas?: number;
  /** Desenha o valor de um jeito próprio — a data formatada, um selo. */
  children?: React.ReactNode;
  className?: string;
  /** Some com o lápis. Para onde o próprio texto já convida ao clique. */
  semLapis?: boolean;
  desabilitado?: boolean;
  /**
   * Nasce já em edição.
   *
   * Só é lido na montagem, e isso está certo aqui: quem passa `true` monta o
   * componente no momento do clique (ver `DataEditavel` abaixo), então não há
   * valor velho para ficar preso.
   */
  comecarEditando?: boolean;
}

export const CampoEditavel: React.FC<Props> = ({
  valor,
  aoSalvar,
  tipo = 'texto',
  opcoes = [],
  vazio = 'Não preenchido',
  placeholder,
  linhas = 6,
  children,
  className,
  semLapis = false,
  desabilitado = false,
  comecarEditando = false,
}) => {
  /**
   * Todos os hooks antes de qualquer `return`. Este componente aparece e
   * desaparece com o modo de edição, e um hook declarado depois de uma guarda
   * rodaria em duas listas diferentes — erro #310, tela branca.
   */
  const [editando, setEditando] = useState(comecarEditando);
  const [rascunho, setRascunho] = useState(valor);
  const campoRef = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>(null);

  // Repõe o valor quando ele muda por fora (outra aba, outro campo salvo).
  // Sem isto o campo guardaria o texto de quando montou.
  useEffect(() => {
    if (!editando) setRascunho(valor);
  }, [valor, editando]);

  useEffect(() => {
    if (editando) campoRef.current?.focus();
  }, [editando]);

  const salvar = () => {
    setEditando(false);
    if (rascunho !== valor) aoSalvar(rascunho);
  };

  const cancelar = () => {
    setRascunho(valor);
    setEditando(false);
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelar();
      return;
    }
    // `Ctrl+Enter` no texto longo — Enter sozinho ali é quebra de linha.
    // No campo de uma linha, Enter salva, que é o que a pessoa espera.
    const confirma = tipo === 'textoLongo' ? e.key === 'Enter' && (e.ctrlKey || e.metaKey) : e.key === 'Enter';
    if (confirma) {
      e.preventDefault();
      salvar();
    }
  };

  const classeDeEntrada =
    'w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 ' +
    'rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white';

  if (editando) {
    return (
      <div className="space-y-2">
        {tipo === 'textoLongo' && (
          <textarea
            ref={campoRef as React.RefObject<HTMLTextAreaElement>}
            rows={linhas}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={placeholder}
            className={`${classeDeEntrada} leading-relaxed resize-y`}
          />
        )}

        {tipo === 'texto' && (
          <input
            ref={campoRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={placeholder}
            className={classeDeEntrada}
          />
        )}

        {tipo === 'dataHora' && (
          /**
           * **O campo mostra hora de parede no fuso da agência**, não no do
           * aparelho. `datetime-local` interpreta no fuso do navegador, e sem a
           * conversão um membro da equipe em outro estado agendaria uma hora
           * diferente do colega — no mesmo post, sem nada avisar (armadilha
           * 8.2).
           */
          <input
            ref={campoRef as React.RefObject<HTMLInputElement>}
            type="datetime-local"
            value={deUtcParaParede(rascunho)}
            onChange={(e) => {
              const parede = e.target.value;
              // Campo esvaziado devolve string vazia, nunca uma data: o
              // `new Date('')` do V8 viraria 1º de janeiro de 2000, e o cron
              // publicaria na primeira passada por já estar vencido.
              setRascunho(parede ? deParedeParaUtc(parede).toISOString() : '');
            }}
            onKeyDown={aoTeclar}
            className={classeDeEntrada}
          />
        )}

        {tipo === 'selecao' && (
          <select
            ref={campoRef as React.RefObject<HTMLSelectElement>}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={aoTeclar}
            className={`${classeDeEntrada} cursor-pointer`}
          >
            {opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-slate-400 mr-auto">
            {tipo === 'textoLongo' ? 'Ctrl+Enter salva' : 'Enter salva'} · Esc cancela
          </span>
          <Button variant="ghost" size="icon-sm" type="button" onClick={cancelar} aria-label="Cancelar edição">
            <X className="w-4 h-4" />
          </Button>
          <Button size="icon-sm" type="button" onClick={salvar} aria-label="Salvar">
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Fora da edição é um `<button>`, não um `<div onClick>`.
   *
   * Ele é o papel "card clicável" que `tests/botoes.test.ts` nomeia — tem
   * conteúdo em bloco e altura própria, então não cabe na escala do `Button`.
   * Mas continua sendo um botão de verdade: recebe foco, responde ao Enter e é
   * anunciado como clicável. Um `div` com `onClick` não é nada disso.
   */
  return (
    <button
      type="button"
      disabled={desabilitado}
      onClick={() => !desabilitado && setEditando(true)}
      title={desabilitado ? undefined : 'Clique para editar'}
      className={cn(
        'group w-full text-left rounded-lg transition',
        desabilitado
          ? 'cursor-default'
          : 'cursor-text hover:bg-purple-50/60 dark:hover:bg-purple-950/20 ' +
              'hover:ring-1 hover:ring-purple-200 dark:hover:ring-purple-900',
        className
      )}
    >
      <span className="flex items-start gap-2">
        <span className="flex-1 min-w-0">
          {children ?? (
            <span
              className={cn(
                'block text-xs whitespace-pre-wrap leading-relaxed',
                valor ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'
              )}
            >
              {valor || vazio}
            </span>
          )}
        </span>

        {/* O lápis só aparece no hover: sempre visível, ele vira ruído em
            cada campo da tela; ausente, ninguém descobre que dá para editar. */}
        {!semLapis && !desabilitado && (
          <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-purple-500 transition" />
        )}
      </span>
    </button>
  );
};

/**
 * A linha de uma data com o botão "Editar" ao lado, como no documento.
 *
 * Existe além do `CampoEditavel` porque a data tem um desenho próprio — ícone,
 * rótulo e valor em duas linhas — e ele se repete: data agendada e prazo de
 * aprovação, lado a lado.
 */
export const DataEditavel: React.FC<{
  rotulo: string;
  valorIso: string;
  aoSalvar: (iso: string) => void;
  formatar: (iso: string) => string;
  Icone: React.FC<{ className?: string }>;
  corDoIcone: string;
}> = ({ rotulo, valorIso, aoSalvar, formatar, Icone, corDoIcone }) => {
  const [editando, setEditando] = useState(false);

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
      <Icone className={`w-5 h-5 shrink-0 ${corDoIcone}`} />

      <div className="min-w-0 flex-1">
        {/* `whitespace-nowrap` no rótulo: sem ele "Deadline de aprovação"
            quebra em três linhas quando o cartão aperta, e a data — que é o
            que a linha existe para mostrar — é a que sai cortada. */}
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {rotulo}
        </span>

        {editando ? (
          <CampoEditavel
            valor={valorIso}
            tipo="dataHora"
            semLapis
            comecarEditando
            aoSalvar={(iso) => {
              setEditando(false);
              aoSalvar(iso);
            }}
          />
        ) : (
          <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
            {valorIso ? formatar(valorIso) : '—'}
          </span>
        )}
      </div>

      {!editando && (
        <ComTooltip texto={`Editar ${rotulo.toLowerCase()}`}>
          <Button variant="secondary" onClick={() => setEditando(true)} className="shrink-0">
            Editar
          </Button>
        </ComTooltip>
      )}
    </div>
  );
};

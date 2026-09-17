import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, StickyNote, X } from 'lucide-react';

import type { Client, ClientAnnotation } from '../../types';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';
import { ComTooltip } from '../ui/tooltip';
import { useConfirmacao } from '../ui/alert-dialog';
import { formatDateTime } from '../../lib/utils';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

/**
 * Anotações da agência sobre o cliente, dentro da aba Arquivos.
 *
 * **Não confundir com "Notas Fiscais"**, que é outra aba, nem com
 * `client.notes`, que é um texto solto exibido no card da lista. Aqui são
 * blocos: cada um com título, data e as três ações pedidas — visualizar,
 * editar e excluir.
 *
 * Elas **nunca saem para o Portal do Cliente**, e quem recorta é o banco:
 * `portal_dados` subtrai `annotations` da linha antes de responder, para todos
 * os papéis. Esconder a seção na tela do portal com o texto já no navegador
 * seria a armadilha 9 — e o que se escreve aqui é justamente o que a agência
 * anota *sobre* o cliente.
 */

interface Props {
  client: Client;
}

export const AnotacoesDoCliente: React.FC<Props> = ({ client }) => {
  const { addClientAnnotation, updateClientAnnotation, deleteClientAnnotation } = usePostfy();

  /**
   * Todo hook antes de qualquer `return` — inclusive os dois dos diálogos.
   * Declarados no meio do componente, a contagem muda entre a lista vazia e a
   * lista cheia, e o React derruba a árvore com o erro #310 (armadilha 8.1).
   */
  const { pedir, dialogo: dialogoDeConfirmacao } = useConfirmacao();
  const [emEdicao, setEmEdicao] = useState<ClientAnnotation | null>(null);
  const [criando, setCriando] = useState(false);
  const [lendo, setLendo] = useState<ClientAnnotation | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');

  const anotacoes = client.annotations || [];
  const formularioAberto = criando || emEdicao !== null;

  const abrirNova = () => {
    setEmEdicao(null);
    setTitulo('');
    setConteudo('');
    setCriando(true);
  };

  /**
   * O estado do formulário nasce aqui, no clique, e não de um `useState(x)`
   * lido só na primeira renderização — que é o valor velho preso da armadilha
   * 8.1. Editar a segunda anotação depois da primeira mostraria o texto da
   * primeira.
   */
  const abrirEdicao = (anotacao: ClientAnnotation) => {
    setCriando(false);
    setTitulo(anotacao.title);
    setConteudo(anotacao.content);
    setEmEdicao(anotacao);
  };

  const fechar = () => {
    setCriando(false);
    setEmEdicao(null);
    setTitulo('');
    setConteudo('');
  };

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    const dados = { title: titulo.trim(), content: conteudo.trim() };
    if (emEdicao) updateClientAnnotation(client.id, emEdicao.id, dados);
    else addClientAnnotation(client.id, dados);
    fechar();
  };

  const excluir = (anotacao: ClientAnnotation) => {
    pedir({
      titulo: 'Excluir esta anotação?',
      // `descricao` é obrigatória de propósito: "Tem certeza?" é a pergunta
      // errada — o que decide é a consequência.
      descricao: `"${anotacao.title}" sai da ficha do cliente e não há como recuperar o texto.`,
      rotuloConfirmar: 'Excluir anotação',
      destrutivo: true,
      aoConfirmar: () => deleteClientAnnotation(client.id, anotacao.id),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Anotações</h4>
          <p className="text-xs text-slate-500">
            Blocos de texto sobre o cliente, só para a equipe. Não aparecem no Portal do Cliente.
          </p>
        </div>
        <Button onClick={abrirNova} disabled={formularioAberto} className="shrink-0">
          <Plus className="w-4 h-4" />
          Nova Anotação
        </Button>
      </div>

      {formularioAberto && (
        <form
          onSubmit={salvar}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60 shadow-md space-y-4 animate-in fade-in"
        >
          <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">
            {emEdicao ? 'Editar anotação' : 'Nova anotação'}
          </h5>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Combinado da reunião de 12/09"
              className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Anotação</label>
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={6}
              placeholder="O que precisa ficar registrado sobre este cliente."
              className="w-full p-2.5 text-xs border rounded-xl bg-slate-50 dark:bg-slate-950 dark:border-slate-800 resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={fechar} className="dark:hover:text-white">
              Cancelar
            </Button>
            <Button type="submit">{emEdicao ? 'Salvar alterações' : 'Salvar anotação'}</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {anotacoes.map((anotacao) => (
          <div
            key={anotacao.id}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-start justify-between gap-3 hover:border-purple-300 transition"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/40">
                <StickyNote className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                  {anotacao.title}
                </span>
                {/*
                  Duas linhas do conteúdo, não o texto inteiro: o card é uma
                  lista, e uma anotação longa empurraria as outras para fora da
                  tela. O texto completo é o que o "Visualizar" abre.
                */}
                {anotacao.content && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                    {anotacao.content}
                  </p>
                )}
                <span className="text-[11px] text-slate-400 block mt-1">
                  {anotacao.updatedAt !== anotacao.createdAt ? 'editada em ' : ''}
                  {formatDateTime(anotacao.updatedAt)}
                </span>
              </div>
            </div>

            {/* Ícone solto sempre com tooltip: é a regra do projeto, e aqui
                são três seguidos, que sozinhos não se explicam. */}
            <div className="flex items-center gap-1 shrink-0">
              <ComTooltip texto="Visualizar anotação">
                <Button variant="ghost" size="icon-sm" onClick={() => setLendo(anotacao)}>
                  <Eye className="w-4 h-4" />
                </Button>
              </ComTooltip>
              <ComTooltip texto="Editar anotação">
                <Button variant="ghost" size="icon-sm" onClick={() => abrirEdicao(anotacao)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </ComTooltip>
              <ComTooltip texto="Excluir anotação">
                <Button variant="destructive" size="icon-sm" onClick={() => excluir(anotacao)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </ComTooltip>
            </div>
          </div>
        ))}

        {anotacoes.length === 0 && !formularioAberto && (
          <div className="col-span-2 text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            Nenhuma anotação para este cliente ainda.
          </div>
        )}
      </div>

      {/* `open={!!lendo}` no lugar de `{lendo && (...)}`: assim o Radix
          monta e desmonta o diálogo, com a animação de saída e o foco
          devolvido ao card que abriu. */}
      <Dialog open={!!lendo} onOpenChange={(aberto) => !aberto && setLendo(null)}>
        {lendo && (
          <DialogContent tamanho="formulario" className="p-0 gap-0">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <DialogTitle asChild>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white break-words">
                    {lendo.title}
                  </h5>
                </DialogTitle>
                <span className="text-[11px] text-slate-400">
                  {formatDateTime(lendo.updatedAt)}
                </span>
              </div>
              <ComTooltip texto="Fechar">
                <Button variant="ghost" size="icon-sm" onClick={() => setLendo(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </ComTooltip>
            </div>

            <div className="p-5 overflow-y-auto">
              {lendo.content ? (
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {lendo.content}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Esta anotação tem só o título.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => {
                  const alvo = lendo;
                  setLendo(null);
                  abrirEdicao(alvo);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/*
        Sem esta linha o `pedir` não abre nada: o hook devolve o diálogo e quem
        chamou precisa pô-lo na árvore. Esquecer não quebra `tsc`, nem o
        vitest, nem o build — o clique em "Excluir" simplesmente não faz nada.
      */}
      {dialogoDeConfirmacao}
    </div>
  );
};

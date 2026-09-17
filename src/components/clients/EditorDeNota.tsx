import React, { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import type { ClientFile } from '../../types';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle,
} from '../ui/dialog';

/**
 * O bloco de notas — criar, ler e editar.
 *
 * Ele guarda o que a agência escreve **sobre** o cliente: o que ele falou na
 * reunião, o combinado que não virou contrato, o detalhe que a próxima pessoa
 * precisa saber. Mora em `clients.files`, como anexo e link, porque para quem
 * usa os três respondem a mesma pergunta — e continua **interno**: quem o
 * recorta é o banco (`portal_dados` filtra as linhas de `kind = 'nota'`), não
 * esta tela.
 *
 * **Ler e editar são a mesma janela, com um botão de diferença.** Eram duas
 * antes, e a de leitura existia só para mostrar o texto inteiro — quem abria
 * para reler e via um erro de digitação tinha de fechar e reabrir no outro
 * modo.
 */
export const EditorDeNota: React.FC<{
  /** A nota aberta, ou `'nova'` para criar. `null` fecha. */
  nota: ClientFile | 'nova' | null;
  aoFechar: () => void;
  aoSalvar: (dados: { name: string; content: string }) => void;
}> = ({ nota, aoFechar, aoSalvar }) => {
  const criando = nota === 'nova';
  const existente = criando ? null : nota;

  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);

  /**
   * Repõe os campos a cada nota aberta, e decide o modo.
   *
   * `useState(nota.name)` seria lido só na primeira renderização: abrir a
   * segunda nota mostraria o texto da primeira. É a armadilha 8.1, e por isso
   * a dependência é o `id` — o objeto é recriado a cada render do pai.
   */
  useEffect(() => {
    if (!nota) return;
    setTitulo(existente?.name || '');
    setTexto(existente?.content || '');
    // Nota nova já abre escrevendo; nota existente abre lendo.
    setEditando(criando);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criando, existente?.id]);

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    aoSalvar({ name: titulo.trim(), content: texto });
    aoFechar();
  };

  const entrada =
    'w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500';

  return (
    /*
      O `{nota && (` fica dentro do `Dialog`, envolvendo o conteúdo: JSX avalia
      os filhos na criação do elemento, não na renderização, então `nota.name`
      rodaria com a janela fechada — que é o estado normal dela.
    */
    <Dialog open={!!nota} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {nota && (
        <DialogContent tamanho="largo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-500" />
              {criando ? 'Novo bloco de notas' : titulo || 'Bloco de notas'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={salvar} className="contents">
            <DialogBody className="space-y-4">
              {editando ? (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Dados comerciais"
                      className={`${entrada} font-semibold`}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Conteúdo
                    </label>
                    <textarea
                      rows={12}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="O que a próxima pessoa precisa saber sobre este cliente."
                      className={`${entrada} leading-relaxed`}
                    />
                  </div>
                </>
              ) : (
                /* `whitespace-pre-wrap`: a nota é texto corrido escrito à mão,
                   e as quebras de linha são do autor. Sem isto, uma lista de
                   itens vira um parágrafo só. */
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                  {texto || (
                    <span className="italic text-slate-400">Este bloco está vazio.</span>
                  )}
                </p>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Só a equipe da agência vê este bloco. Ele não aparece no Portal
                do Cliente.
              </p>
            </DialogBody>

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={aoFechar}>
                Fechar
              </Button>
              {editando ? (
                <Button type="submit" disabled={!titulo.trim()}>
                  Salvar
                </Button>
              ) : (
                <Button type="button" onClick={() => setEditando(true)}>
                  Editar
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
};

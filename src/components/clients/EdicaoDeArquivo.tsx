import React, { useEffect, useState } from 'react';
import type { ClientFile } from '../../types';
import { tipoDoArquivo } from '../../lib/arquivosDoCliente';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle,
} from '../ui/dialog';

/**
 * Corrigir um arquivo já cadastrado.
 *
 * O card tinha duas ações — abrir/baixar e excluir — e nenhuma delas corrige
 * nada. Arrumar um nome digitado errado ou trocar a categoria passava por
 * **excluir e cadastrar de novo**, e num link externo isso perde a URL, que é
 * a única coisa que a linha carrega. O caminho de correção não pode ser o de
 * perda.
 *
 * **O que dá para editar depende do que a linha é**, e essa é a decisão:
 *
 * - **Link colado** (Drive, Dropbox): a URL é editável. É justamente ela que
 *   costuma quebrar — a pasta é movida, o link é regerado — e sem este campo a
 *   correção seria apagar a linha e refazer.
 * - **Arquivo enviado**: a URL **não** aparece. Ela aponta para o objeto no
 *   R2, e digitar outra coisa ali não move arquivo nenhum: deixaria um card
 *   apontando para o vazio, com cara de certo. Trocar o arquivo é cadastrar
 *   outro — e o texto na tela diz isso, em vez de o campo sumir sem
 *   explicação.
 */
export const EdicaoDeArquivo: React.FC<{
  arquivo: ClientFile | null;
  aoFechar: () => void;
  aoSalvar: (dados: Partial<Pick<ClientFile, 'name' | 'category' | 'url'>>) => void;
}> = ({ arquivo, aoFechar, aoSalvar }) => {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<ClientFile['category']>('identidade_visual');
  const [url, setUrl] = useState('');

  /**
   * Repõe os campos a cada arquivo aberto.
   *
   * `useState(arquivo.name)` seria lido só na primeira renderização: abrir o
   * segundo arquivo mostraria os dados do primeiro. É a armadilha 8.1, e o
   * efeito depende do `id` porque o objeto é recriado a cada render do pai.
   */
  useEffect(() => {
    if (!arquivo) return;
    setNome(arquivo.name || '');
    setCategoria(arquivo.category);
    setUrl(arquivo.url || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo?.id]);

  const ehLink = arquivo ? tipoDoArquivo(arquivo) === 'link' : false;

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    aoSalvar({
      name: nome.trim(),
      category: categoria,
      // A URL só viaja quando é editável: mandá-la sempre gravaria de volta o
      // mesmo valor num campo que a tela nem mostrou.
      ...(ehLink ? { url: url.trim() } : {}),
    });
    aoFechar();
  };

  const entrada =
    'w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500';

  return (
    /*
      O `{arquivo && (` fica **dentro** do `Dialog`, envolvendo o conteúdo: o
      `open` decide se abre, a guarda decide se o conteúdo chega a existir. JSX
      avalia os filhos na criação do elemento, não na renderização — sem ela,
      `arquivo.name` rodaria com a modal fechada, que é o estado normal dela.
    */
    <Dialog open={!!arquivo} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {arquivo && (
        <DialogContent tamanho="formulario">
          <DialogHeader>
            <DialogTitle>Editar arquivo</DialogTitle>
          </DialogHeader>

          <form onSubmit={salvar} className="contents">
            <DialogBody className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Título do arquivo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={entrada}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as ClientFile['category'])}
                  className={`${entrada} cursor-pointer`}
                >
                  <option value="identidade_visual">Identidade Visual</option>
                  <option value="fotos">Fotos / Ensaio</option>
                  <option value="videos">Vídeos Brutos</option>
                  <option value="documentos">Documentos / Drive</option>
                  <option value="contratos">Contratos</option>
                  <option value="briefing">Briefing</option>
                </select>
              </div>

              {ehLink ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Link
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${entrada} font-mono`}
                  />
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  O endereço não é editável porque ele aponta para o arquivo
                  enviado. Para trocar o arquivo, cadastre outro e exclua este.
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button variant="ghost" type="button" onClick={aoFechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!nome.trim()}>
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
};

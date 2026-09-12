import React from 'react';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import type { Workspace } from '../../types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

/**
 * O quadrado da marca, nos dois tamanhos em que ele aparece.
 *
 * As classes são literais e não montadas por interpolação de propósito: o
 * Tailwind lê o código-fonte como texto para decidir o que gerar, e
 * `rounded-${x}` não existe para ele — a classe some do CSS sem erro nenhum.
 */
const Marca: React.FC<{ agencia: Workspace; grande?: boolean }> = ({
  agencia,
  grande = false,
}) => {
  const caixa = grande
    ? 'w-9 h-9 rounded-xl p-1 shadow-xs'
    : 'w-6 h-6 rounded-md p-0.5';

  if (agencia.logo) {
    return (
      <div
        className={`${caixa} overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0`}
      >
        <img
          src={agencia.logo}
          alt={agencia.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${caixa} flex items-center justify-center font-bold text-white shrink-0 ${
        grande ? 'text-xs' : 'text-[10px]'
      }`}
      style={{ backgroundColor: agencia.primaryColor || '#9333ea' }}
    >
      {(agencia.name || 'Agência').substring(0, 2).toUpperCase()}
    </div>
  );
};

/**
 * O seletor de agência, no `DropdownMenu` do shadcn.
 *
 * Era um `useState` com `fixed inset-0` por baixo para captar o clique fora.
 * Funcionava e parava aí: não fechava com `Esc`, não devolvia o foco ao
 * gatilho, não andava com as setas, e por ser filho da barra lateral ficava
 * preso no `overflow` dela — com o menu recolhido, a lista abria dentro de um
 * trilho de 64px. O Radix resolve os quatro de graça, e o portal tira a lista
 * de dentro da barra.
 *
 * **Nada de `⌘1`, `⌘2`, `⌘3` ao lado de cada agência**, que é o que o
 * exemplo do shadcn mostra. No macOS `⌘1`–`⌘9` são reservados do navegador
 * para trocar de aba e uma página não consegue interceptá-los: o atalho
 * apareceria escrito e não funcionaria — a armadilha 9, num canto pequeno.
 *
 * Duas linhas por agência, nome e `@slug`: quem tem muitas agências costuma
 * tê-las com nomes parecidos, e o slug é o que não se repete — é ele que
 * aparece no endereço do portal do cliente.
 */
export const WorkspaceSwitcher: React.FC<{ recolhida?: boolean }> = ({
  recolhida = false,
}) => {
  const {
    currentWorkspace,
    setCurrentWorkspace,
    workspaces,
    setIsCreateWorkspaceModalOpen,
    isPlatformAdmin,
  } = usePostfy();

  // A lista já chega recortada pela RLS: `workspaces` só traz as agências das
  // quais a pessoa é membro (ou todas, para o admin da plataforma).
  //
  // Havia um filtro extra aqui, por `currentUser.workspaceId`, que reduzia a
  // lista à agência do login: quem era membro de três agências enxergava uma
  // só, e não tinha como chegar nas outras. `currentUser.workspaceId` é a
  // agência em que a sessão começou, não o conjunto ao qual a pessoa pertence.
  const visiveis = workspaces;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          `<button>` à mão, e não `<Button>`: o gatilho tem conteúdo em bloco
          (marca + duas linhas de texto) e altura própria. A escala de altura
          fixa cortaria a segunda linha — é o papel "card clicável" que a
          guarda de `tests/botoes.test.ts` nomeia.
        */}
        <button
          type="button"
          title={recolhida ? currentWorkspace?.name : undefined}
          className={`w-full flex items-center gap-2.5 rounded-xl p-1.5 border border-transparent transition cursor-pointer group
            hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700
            data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${recolhida ? 'md:justify-center md:p-0' : 'pr-2.5'}`}
        >
          {currentWorkspace && <Marca agencia={currentWorkspace} grande />}

          <div className={`min-w-0 flex-1 text-left ${recolhida ? 'md:hidden' : ''}`}>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {currentWorkspace?.name || 'Minha Agência'}
            </h1>
            {/* Era aqui que ficava o selo do teste grátis. A situação da
                assinatura passou para o rodapé da barra lateral, num lugar só,
                lida do banco — aqui ela competia com o nome da agência e
                repetia em toda tela o que é informação de cobrança. */}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
              @{currentWorkspace?.slug || 'agencia'}
            </span>
          </div>

          <ChevronsUpDown
            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 ${
              recolhida ? 'md:hidden' : ''
            }`}
          />
        </button>
      </DropdownMenuTrigger>

      {/*
        Recolhida, a lista abre ao lado do trilho, como a do shadcn: embaixo
        de um gatilho de 36px ela sairia flutuando sem âncora visível.
        `min-w-60` é o que impede a lista de herdar a largura do trilho.
      */}
      <DropdownMenuContent
        align="start"
        side={recolhida ? 'right' : 'bottom'}
        sideOffset={6}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
      >
        <DropdownMenuLabel>
          {isPlatformAdmin ? 'Todas as agências' : 'Suas agências'}
        </DropdownMenuLabel>

        {visiveis.map((ws) => {
          const atual = ws.id === currentWorkspace?.id;
          return (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => setCurrentWorkspace(ws)}
              className="gap-2.5 p-2"
            >
              <Marca agencia={ws} />
              <div className="flex-1 min-w-0">
                <span
                  className={`block truncate text-xs ${
                    atual
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'font-medium text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {ws.name}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  @{ws.slug}
                </span>
              </div>
              {atual && <Check className="size-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => setIsCreateWorkspaceModalOpen(true)}
          className="gap-2.5 p-2 font-semibold text-muted-foreground"
        >
          <div className="w-6 h-6 rounded-md border border-border flex items-center justify-center shrink-0">
            <Plus className="size-3.5" />
          </div>
          Criar nova agência
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import React from 'react';
import { UserPlus, X } from 'lucide-react';

import { Avatar } from '../common/Avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { User } from '../../types';

/**
 * Quem da equipe toca esta peça.
 *
 * **Isto substitui um campo que mentia.** A modal de detalhe rotulava
 * `currentUser.name` como "Responsável" — ou seja, quem está **olhando** a
 * tela. Numa agência de quatro pessoas, cada uma abria a mesma peça e lia o
 * próprio nome, e o campo passava por informação porque tinha cara de campo.
 * `designerId`, `copywriterId` e `socialMediaId` existiam no schema desde a
 * primeira migração com ninguém escrevendo neles: a família do `trial_ends_at`,
 * com um rótulo em cima.
 *
 * ### É uma lista, não três gavetas
 *
 * As três colunas antigas sugeriam separar por função. A pergunta que a
 * agência faz ao abrir a peça é outra — *"quem está nisto?"* —, e separar
 * obriga a escolher uma gaveta para quem faz arte e texto, que é a maioria das
 * agências pequenas.
 *
 * ### Quem saiu da equipe continua aparecendo, e isso é decisão
 *
 * O id guardado não tem chave estrangeira. Alguém removido de
 * `workspace_members` deixa de estar em `users`, e aqui vira "Fora da equipe"
 * em vez de sumir: a peça foi feita por alguém, e apagar o nome reescreveria o
 * passado — é a mesma razão de o histórico de etapas não ter backfill.
 */
export const ResponsaveisDaPeca: React.FC<{
  /** Ids escolhidos. */
  valor: string[];
  equipe: User[];
  aoMudar: (ids: string[]) => void;
  /** Só leitura: a peça já foi publicada, ou quem olha não pode mexer. */
  somenteLeitura?: boolean;
}> = ({ valor, equipe, aoMudar, somenteLeitura = false }) => {
  const escolhidos = valor ?? [];
  const disponiveis = equipe.filter((u) => !escolhidos.includes(u.id));

  const tirar = (id: string) => aoMudar(escolhidos.filter((i) => i !== id));
  const por = (id: string) => aoMudar([...escolhidos, id]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {escolhidos.map((id) => {
        const pessoa = equipe.find((u) => u.id === id);
        const nome = pessoa?.name ?? 'Fora da equipe';

        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 max-w-full"
            title={pessoa ? nome : 'Esta pessoa não está mais na equipe da agência.'}
          >
            <Avatar nome={nome} url={pessoa?.avatar} tamanho={16} />
            <span className="truncate">{nome}</span>
            {!somenteLeitura && (
              <button
                type="button"
                onClick={() => tirar(id)}
                aria-label={`Tirar ${nome} desta peça`}
                /*
                  Afordância minúscula dentro de um chip de 20px: qualquer
                  degrau da escala de botão é maior que o chip inteiro. É o
                  terceiro papel que a seção de botões nomeia como exceção.
                */
                className="text-slate-400 hover:text-rose-600 transition cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        );
      })}

      {!somenteLeitura && disponiveis.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-[11px] px-2">
              <UserPlus className="w-3 h-3" />
              {escolhidos.length === 0 ? 'Atribuir' : 'Mais'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Quem está nesta peça</DropdownMenuLabel>
            {disponiveis.map((u) => (
              <DropdownMenuItem key={u.id} onSelect={() => por(u.id)}>
                <Avatar nome={u.name} url={u.avatar} tamanho={18} />
                <span className="truncate">{u.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/*
        **Vazio é dito, não deixado em branco.** Uma linha sem nada ali parece
        campo que não carregou; a frase diz que ninguém foi atribuído, que é um
        estado legítimo e o que a pessoa precisa saber para agir.
      */}
      {escolhidos.length === 0 && somenteLeitura && (
        <span className="text-[11px] text-slate-400">Ninguém atribuído</span>
      )}
    </div>
  );
};

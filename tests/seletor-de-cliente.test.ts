import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './util/semComentarios';

/**
 * "Novo cliente" no seletor do cabeçalho, e o caminho que ele percorre.
 *
 * O botão está numa árvore (o cabeçalho) e o formulário que ele abre está em
 * outra (`ClientsView`), com o pedido passando pelo contexto. São três elos, e
 * **os três falham em silêncio**: o clique não dá erro, a tela não muda, e
 * `tsc`, vitest e `vite build` ficam os três verdes. É a mesma família do
 * `useConfirmacao()` sem o `{dialogo}` renderizado — o clique não faz nada,
 * sem pista nenhuma de por quê.
 */

const RAIZ = join(__dirname, '..');


const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const contexto = ler('src', 'context', 'PostfyContext.tsx');
const seletor = ler('src', 'components', 'layout', 'ClientSwitcher.tsx');
const tela = ler('src', 'components', 'clients', 'ClientsView.tsx');

describe('o pedido sai do seletor e chega na tela', () => {
  it('o seletor pede o cadastro em vez de navegar por conta própria', () => {
    // `setActiveTab('clientes')` daqui levaria para a lista e pararia lá: a
    // pessoa clicou em "Novo cliente" e teria que achar o botão de novo.
    expect(
      seletor,
      'o botão de cadastrar saiu do seletor de cliente'
    ).toMatch(/abrirNovoCliente\(\)/);
  });

  it('abrirNovoCliente troca de aba junto com o pedido', () => {
    /**
     * Sem a troca de aba o pedido é levantado numa tela que ninguém está
     * olhando: o menu fecha, nada acontece, e não há erro em lugar nenhum.
     * Quem clica conclui que o botão está quebrado — e está.
     */
    const inicio = contexto.indexOf('const abrirNovoCliente');
    expect(inicio, 'abrirNovoCliente sumiu do contexto').toBeGreaterThan(-1);

    const corpo = contexto.slice(inicio, contexto.indexOf('}, [', inicio));
    expect(
      corpo,
      'abrirNovoCliente deixou de abrir a tela de Clientes — o clique passa a não fazer nada'
    ).toMatch(/setActiveTab\('clientes'\)/);
  });

  it('a tela consome o pedido ao abrir o formulário', () => {
    /**
     * Pedido que fica de pé reabre o cadastro toda vez que alguém volta para
     * Clientes, sem ter pedido nada — e não há como fechá-lo em definitivo,
     * porque fechar mexe só no estado local.
     */
    const inicio = tela.indexOf('if (!pedidoDeNovoCliente) return;');
    expect(inicio, 'a tela deixou de ouvir o pedido de novo cliente').toBeGreaterThan(-1);

    const corpo = tela.slice(inicio, inicio + 400);
    expect(
      corpo,
      'o pedido deixou de ser consumido — o formulário reabre sozinho a cada visita'
    ).toMatch(/consumirPedidoDeNovoCliente\(\)/);
    expect(corpo).toMatch(/setIsAddingClient\(true\)/);
  });

  it('o efeito do pedido fica acima do return da ficha', () => {
    /**
     * `ClientsView` tem uma guarda que devolve outra tela inteira
     * (`return <ClientDetail ...>`) quando a URL aponta para um cliente. Hook
     * declarado depois dela roda em duas listas diferentes conforme a ficha
     * esteja aberta, e o React derruba a árvore com o erro #310 — que em
     * produção chega minificado, na tela de erro genérica (armadilha 8.1).
     *
     * `tests/hooks-antes-do-return.test.ts` não alcança este caso: ele recorta
     * só o `return null;` de guarda, e aqui o retorno é um componente.
     */
    const efeito = tela.indexOf('if (!pedidoDeNovoCliente) return;');
    const guarda = tela.indexOf('return <ClientDetail');

    expect(guarda, 'a guarda da ficha mudou de forma — reveja este teste').toBeGreaterThan(-1);
    expect(
      efeito,
      'o efeito do pedido caiu abaixo do `return <ClientDetail>`: com a ficha aberta ' +
        'o componente passa a ter menos hooks, e o React derruba a árvore (erro #310)'
    ).toBeLessThan(guarda);
  });
});

describe('ainda há como limpar o filtro pelo menu', () => {
  it('a linha "Todos os Clientes" volta o filtro para todos', () => {
    /**
     * O botão "Limpar Filtro" do cabeçalho do menu saiu para o de cadastrar
     * caber: ele chamava `setClientFilter('all')` e fechava o menu, que é
     * exatamente o que esta linha já fazia — dois botões para a mesma ação,
     * e o título da seção espremido a 27px entre os dois.
     *
     * Com um só, esta linha é **a** saída de um filtro ativo dentro do menu.
     * Se ela mudar de ação, o filtro passa a não ter como ser desligado por
     * aqui, e nada acusa.
     */
    const rotulo = seletor.indexOf('Exibir todos os');
    expect(rotulo, 'a linha "Todos os Clientes" sumiu do menu').toBeGreaterThan(-1);

    const abre = seletor.lastIndexOf('<button', rotulo);
    const linha = seletor.slice(abre, rotulo);
    expect(
      linha,
      'a linha "Todos os Clientes" deixou de limpar o filtro — e ela é a única saída que sobrou'
    ).toMatch(/setClientFilter\('all'\)/);
  });
});

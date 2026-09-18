import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarPainelDeErros } from '../src/lib/errosDeGravacao';
import { semComentarios } from './util/semComentarios';

/**
 * O aviso de gravação que falhou **sobrevive ao commit que o causou**.
 *
 * As dez coleções de `PostfyContext` dividem uma fila de gravação e dividiam
 * um `syncState`. `createJob` mexe em duas delas no mesmo render — `jobs` e
 * `activityLogs` —, a fila é sequencial e o log vem depois. Quando o insert
 * do conteúdo falhava, a faixa acendia e o `'saved'` do log a apagava
 * milissegundos depois: **o registro de "Criou o conteúdo" apagava o aviso de
 * que o conteúdo não foi criado.**
 *
 * É a razão de os três bugs de gravação silenciosa da semana terem passado
 * despercebidos, e os números de produção fecham com ela: numa tarde, dez
 * linhas `Criou o conteúdo` em `activity_logs` e **uma** em `jobs`.
 *
 * A lógica é pura de propósito, para esta guarda **exercitar** a decisão em
 * vez de descrever o mecanismo. Guarda que descreve o mecanismo aprova
 * qualquer mecanismo com aquela forma — foi o que aconteceu com as quatro
 * guardas da bandeira booleana, que passavam enquanto o produto perdia dado.
 */

describe('o sucesso de uma coleção não apaga o erro de outra', () => {
  it('reproduz o caso do createJob: jobs falha, activityLogs passa', () => {
    const painel = criarPainelDeErros();

    // 1. o insert do conteúdo é recusado pelo banco
    const acendeu = painel.falhou('jobs', 'violates check constraint "jobs_format_check"');
    expect(acendeu).toEqual({
      estado: 'error',
      mensagem: 'violates check constraint "jobs_format_check"',
    });

    // 2. o log da criação, logo atrás na mesma fila, grava sem problema
    const depoisDoLog = painel.deuCerto('activityLogs');

    /**
     * **A asserção que importa.** Antes, este passo devolvia `'saved'` e
     * apagava a faixa — e o produto passava a perder conteúdo em silêncio.
     * `null` significa "não mexa no estado": o aviso do `jobs` continua de pé.
     */
    expect(depoisDoLog, 'o sucesso do log voltou a apagar o erro do conteúdo').toBeNull();
    expect(painel.abertos).toBe(1);
  });

  it('a faixa só apaga quando quem falhou volta a gravar', () => {
    const painel = criarPainelDeErros();
    painel.falhou('jobs', 'recusado');
    painel.deuCerto('activityLogs');
    painel.deuCerto('clients');

    expect(painel.abertos, 'vizinhas bem-sucedidas limparam o erro alheio').toBe(1);

    const apagou = painel.deuCerto('jobs');
    expect(apagou).toEqual({ estado: 'saved', mensagem: null });
    expect(painel.abertos).toBe(0);
  });

  it('duas coleções falhando mantêm as duas até a última se resolver', () => {
    const painel = criarPainelDeErros();
    painel.falhou('jobs', 'conteúdo recusado');
    painel.falhou('clients', 'cliente recusado');
    expect(painel.abertos).toBe(2);

    const aindaUma = painel.deuCerto('jobs');
    expect(aindaUma?.estado, 'uma falha resolvida apagou a outra').toBe('error');
    expect(aindaUma?.mensagem).toBe('cliente recusado');

    expect(painel.deuCerto('clients')).toEqual({ estado: 'saved', mensagem: null });
  });

  it('o mesmo motivo em duas coleções não vira texto repetido', () => {
    // Uma falha de rede derruba todas as gravações do commit; a faixa
    // repetindo a mesma frase quatro vezes esconde o que ela diz.
    const painel = criarPainelDeErros();
    painel.falhou('jobs', 'sem conexão');
    const r = painel.falhou('clients', 'sem conexão');
    expect(r?.mensagem).toBe('sem conexão');
  });

  it('gravação bem-sucedida sem erro nenhum em aberto confirma o estado salvo', () => {
    // O caminho normal: nada falhou, e a faixa continua apagada.
    const painel = criarPainelDeErros();
    expect(painel.deuCerto('jobs')).toEqual({ estado: 'saved', mensagem: null });
  });
});

describe('a origem é a coleção, e a faixa diz a consequência', () => {
  const RAIZ = join(__dirname, '..');

  it('a fila reporta e limpa por coleção, não por um rótulo genérico', () => {
    /**
     * Passar a mesma string para todas as coleções recriaria o bug por outro
     * caminho: uma origem só, que qualquer sucesso limpa.
     */
    const contexto = semComentarios(
      readFileSync(join(RAIZ, 'src', 'context', 'PostfyContext.tsx'), 'utf-8')
    );
    expect(contexto, 'a fila deixou de reportar o erro pela coleção').toMatch(
      /relatarErro\(erro, 'salvar as alterações', nome as string\)/
    );
    expect(contexto, 'a fila deixou de limpar o erro pela coleção').toMatch(
      /gravacaoDeuCerto\(nome as string\)/
    );
  });

  it('a faixa diz que a alteração não foi salva, antes do motivo técnico', () => {
    /**
     * Ela mostrava só a mensagem crua do Postgres — em inglês e nomeando uma
     * constraint. Quem lê `violates check constraint "jobs_format_check"` não
     * conclui "meu conteúdo não foi salvo": conclui que teve um soluço. E a
     * tela continua mostrando a peça, porque a gravação é derivada de diff.
     */
    const app = semComentarios(readFileSync(join(RAIZ, 'src', 'App.tsx'), 'utf-8'));
    const faixa = app.slice(app.indexOf("syncState === 'error'"));
    expect(faixa.slice(0, 900), 'a faixa voltou a mostrar só a mensagem técnica').toMatch(
      /não chegou ao banco/
    );
    expect(faixa.slice(0, 900), 'a faixa deixou de dizer o que fazer').toMatch(/recarregue/i);
    expect(faixa.slice(0, 900), 'o detalhe técnico sumiu — o relato fica sem o motivo').toMatch(
      /\{syncError\}/
    );
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  familiaDoArquivo,
  extensaoDoArquivo,
  tipoDoArquivo,
} from '../src/lib/arquivosDoCliente';
import type { ClientFile } from '../src/types';
import { semComentariosTudo as semComentarios } from './util/semComentarios';

/**
 * Anotações do cliente, e a lista de arquivos que ficou ao lado delas.
 *
 * A guarda que importa aqui é a primeira: `portal_dados` responde com
 * `to_jsonb(cliente)`, que é a **linha inteira**. Coluna nova nasce visível
 * para quem entra pelo portal sem ninguém ter decidido isso — foi assim que
 * `passwords`, `invoices` e `briefing` saíram na primeira versão do portal.
 *
 * E `annotations` é o pior caso possível dessa falha: é o que a agência
 * escreve *sobre* o cliente, lido pelo próprio cliente.
 */

const RAIZ = join(__dirname, '..');


/**
 * A definição que **vale** de `portal_dados`.
 *
 * Ela é declarada em mais de uma migração — `create or replace` substitui a
 * anterior —, então ler a primeira que aparecer afirmaria o recorte de uma
 * versão que o banco já não tem. Vence a última pelo nome do arquivo, que é a
 * ordem em que o Supabase aplica.
 */
const ultimaDefinicaoDePortalDados = (): string => {
  const pasta = join(RAIZ, 'supabase', 'migrations');
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();

  let corpo = '';
  for (const arquivo of arquivos) {
    const texto = readFileSync(join(pasta, arquivo), 'utf-8');
    const inicio = texto.indexOf('create or replace function public.portal_dados');
    if (inicio === -1) continue;
    const fim = texto.indexOf('\n$$;', inicio);
    corpo = texto.slice(inicio, fim === -1 ? undefined : fim);
  }
  return corpo;
};

const portalDados = ultimaDefinicaoDePortalDados();

describe('o portal não recebe o que é interno da agência', () => {
  it('a definição de portal_dados foi encontrada', () => {
    expect(portalDados, 'portal_dados sumiu das migrações').toContain('to_jsonb(cliente)');
  });

  for (const campo of ['annotations', 'notes']) {
    it(`${campo} é subtraído para todos os papéis`, () => {
      /**
       * "Para todos os papéis" é a parte que a guarda mede, e ela mede pela
       * posição: a subtração tem que vir **antes** do `if usuario.role`, senão
       * ela vale só para quem não é editor — e o editor é o cliente.
       */
      const corpo = semComentarios(portalDados);
      const subtracao = corpo.indexOf(`- '${campo}'`);
      const condicional = corpo.indexOf('if usuario.role');

      expect(
        subtracao,
        `portal_dados devolve ${campo} ao portal: to_jsonb(cliente) leva a linha inteira, ` +
          `e o que a agência anota sobre o cliente iria para o próprio cliente`
      ).toBeGreaterThan(-1);

      expect(
        subtracao,
        `${campo} só é subtraído dentro do if de papel — o editor, que é o cliente, continua recebendo`
      ).toBeLessThan(condicional);
    });
  }

  it('o recorte por papel continua de pé', () => {
    // O que já existia não pode sair junto: esta migração substitui a função
    // inteira, e reescrevê-la de memória é como se perde uma linha destas.
    const corpo = semComentarios(portalDados);
    for (const campo of ['passwords', 'invoices', 'briefing', 'files']) {
      expect(corpo, `${campo} saiu do recorte por papel`).toContain(`- '${campo}'`);
    }
    expect(corpo, 'o bloco workspace sumiu — o portal perde a marca da agência').toContain(
      "'workspace'"
    );
  });

  it('a tela não é a única a esconder as anotações', () => {
    /**
     * A regra do projeto: o recorte é do banco, não da tela. Se o portal
     * passar a desenhar anotações, isso vira uma decisão explícita — e esta
     * guarda cai junto, de propósito.
     */
    const portal = readFileSync(
      join(RAIZ, 'src', 'components', 'portal', 'ClientPortalView.tsx'),
      'utf-8'
    );
    expect(
      semComentarios(portal),
      'o Portal do Cliente passou a desenhar annotations'
    ).not.toMatch(/\.annotations\b/);
  });
});

const arquivo = (over: Partial<ClientFile>): ClientFile => ({
  id: 'x',
  name: 'contrato.pdf',
  category: 'contratos',
  url: 'https://midia.exemplo.com/ws/123-abc-contrato.pdf',
  size: '2,4 MB',
  uploadedAt: '2026-09-16',
  ...over,
});

describe('arquivo anexado e link são coisas diferentes', () => {
  it('o campo gravado manda, quando existe', () => {
    expect(tipoDoArquivo(arquivo({ kind: 'link' }))).toBe('link');
    expect(tipoDoArquivo(arquivo({ kind: 'arquivo' }))).toBe('arquivo');
  });

  it('linha antiga sem o campo é derivada', () => {
    /**
     * `size: 'Nuvem'` é o valor literal que `FileUpload` grava no modo
     * "inserir link", onde não há bytes para medir — é a única marca que as
     * linhas antigas deixaram.
     */
    expect(tipoDoArquivo(arquivo({ size: 'Nuvem' }))).toBe('link');
    expect(
      tipoDoArquivo(arquivo({ url: 'https://drive.google.com/file/d/abc/view', size: '—' }))
    ).toBe('link');
    expect(tipoDoArquivo(arquivo({}))).toBe('arquivo');
  });

  it('o PDF tem ícone próprio', () => {
    // O pedido, e o formato que mais aparece em contrato e briefing: era
    // `FolderOpen` para tudo, e "pasta" é o que nenhum deles é.
    expect(familiaDoArquivo(arquivo({ name: 'contrato.pdf' }))).toBe('pdf');
    expect(familiaDoArquivo(arquivo({ name: 'Contrato Final.PDF' }))).toBe('pdf');
    expect(familiaDoArquivo(arquivo({ name: 'logo.svg' }))).toBe('imagem');
    expect(familiaDoArquivo(arquivo({ name: 'reels.mp4' }))).toBe('video');
    expect(familiaDoArquivo(arquivo({ name: 'custos.xlsx' }))).toBe('planilha');
  });

  it('link não ganha família de arquivo, mesmo com cara de um', () => {
    // `.../Contrato.pdf?dl=0` no Dropbox é a pasta de outra pessoa: o ícone
    // de PDF prometeria um arquivo que não é nosso e que não baixa daqui.
    expect(
      familiaDoArquivo(arquivo({ url: 'https://dropbox.com/s/x/Contrato.pdf?dl=0', size: 'Nuvem' }))
    ).toBe('outro');
  });

  it('a extensão sai do nome, e o nome ganha da URL', () => {
    // A chave do R2 é `workspaceId/timestamp-uuid-nome`: a extensão está nos
    // dois lugares, e o nome é o que a pessoa vê.
    expect(extensaoDoArquivo(arquivo({ name: 'briefing.docx' }))).toBe('docx');
    expect(extensaoDoArquivo(arquivo({ name: 'sem extensão' }))).toBe('pdf');
    expect(extensaoDoArquivo(arquivo({ name: 'x', url: 'https://a.com/y.png?v=2' }))).toBe('png');
  });
});

describe('baixar arquivo baixa mesmo', () => {
  const tela = semComentarios(
    readFileSync(join(RAIZ, 'src', 'components', 'clients', 'ClientDetail.tsx'), 'utf-8')
  );

  it('o download passa por fetch + blob, não por <a download>', () => {
    /**
     * `<a download>` **não vale entre origens**: o arquivo mora no R2, em
     * outro domínio, e o navegador ignora o atributo e navega até a URL. PDF e
     * imagem abrem na aba em vez de descer para a máquina — um botão escrito
     * "baixar" que faz outra coisa é a armadilha 9 na forma mais barata.
     */
    expect(tela, 'o download voltou a ser um link, e entre origens ele só abre a aba').toMatch(
      /URL\.createObjectURL\(blob\)/
    );
    expect(tela).toMatch(/a\.download = file\.name/);
  });

  it('quando o CORS barra, a tela diz o que falta', () => {
    // Cair para "abrir em outra aba" calado deixaria a pessoa procurando o
    // arquivo na pasta de downloads. A regra do projeto é nomear o que falta.
    const queda = tela.slice(tela.indexOf('const baixarArquivo'));
    expect(queda.slice(0, 1400), 'a queda do download virou silêncio').toMatch(/avisar\(\{/);
    expect(queda.slice(0, 1400)).toMatch(/CORS/);
  });
});

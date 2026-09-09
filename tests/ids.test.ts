import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Guarda contra o id inventado no cliente.
 *
 * Toda tabela usa `id uuid primary key`. Quando o código gerava
 * `job-${Date.now()}`, o Postgres recusava a linha inteira com
 * `invalid input syntax for type uuid` — e como a persistência é derivada de
 * um diff em segundo plano, a tela seguia mostrando o item que nunca foi
 * salvo. O teste de unidade de novoId() passava; o que faltava era garantir
 * que alguém realmente o usasse.
 */

const varrer = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return varrer(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });

// `id:` seguido de template literal contendo Date.now() — o formato antigo.
const ID_INVENTADO = /\bid:\s*`[^`]*\$\{Date\.now\(\)\}[^`]*`/;

describe('geração de identificador', () => {
  it('nenhum arquivo monta id com Date.now()', () => {
    const culpados = varrer('src')
      .map((arquivo) => ({ arquivo, texto: readFileSync(arquivo, 'utf-8') }))
      .filter(({ texto }) => ID_INVENTADO.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('o repositório manda o id na inserção', () => {
    // Sem isto o banco gera um id diferente do que a tela guardou, e a
    // primeira edição atualiza uma linha que não existe.
    const db = readFileSync('src/lib/db.ts', 'utf-8');
    expect(db).toMatch(/if \(entidade\.id\) linha\.id = entidade\.id;/);
  });
});

/**
 * Guarda contra o dado da agência voltar para o navegador.
 *
 * O cache local existia para a tela não nascer vazia, e cobrou caro: um
 * cliente com logo em base64 ocupou 4,8 MB e estourou a cota do navegador.
 * Pior que o aviso era o efeito silencioso — parte do estado ficava só ali,
 * e o que a tela mostrava dependia de qual máquina abriu.
 *
 * A sessão do Supabase Auth continua no localStorage: é o que mantém o login
 * entre reloads, e não é dado de agência.
 */
describe('nada de dado da aplicação no navegador', () => {
  const PERMITIDOS = [
    'src/lib/analytics.ts', // persistência do id anônimo do PostHog
  ];

  it('nenhum módulo grava no localStorage', () => {
    const culpados = varrer('src')
      .filter((arquivo) => !PERMITIDOS.includes(arquivo.replace(/\\/g, '/')))
      .map((arquivo) => ({ arquivo, texto: readFileSync(arquivo, 'utf-8') }))
      // Só chamada de verdade; menção em comentário não conta.
      .filter(({ texto }) =>
        /(localStorage|sessionStorage)\s*\.\s*(setItem|getItem|removeItem)/.test(texto)
      )
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });
});

/**
 * Guarda contra o base64 voltar.
 *
 * `readAsDataURL` transforma o arquivo numa string dentro do próprio
 * registro. Um logo de cliente ocupou 4,8 MB assim: estourou a cota do
 * navegador e ainda foi para uma coluna de texto no Postgres, acompanhando o
 * registro em toda leitura.
 *
 * O upload correto manda o binário direto para o R2 e guarda só a URL.
 */
describe('arquivo não vira string no registro', () => {
  it('nenhum componente usa readAsDataURL', () => {
    const culpados = varrer('src')
      .map((arquivo) => ({ arquivo, texto: readFileSync(arquivo, 'utf-8') }))
      .filter(({ texto }) => /\breadAsDataURL\s*\(/.test(texto))
      .map(({ arquivo }) => arquivo);

    expect(culpados).toEqual([]);
  });

  it('os dois componentes de envio passam pelo R2', () => {
    for (const arquivo of [
      'src/components/ui/file-upload.tsx',
      'src/components/common/MediaUploader.tsx',
    ]) {
      expect(readFileSync(arquivo, 'utf-8'), arquivo).toContain('arquivosApi.enviar');
    }
  });
});

/**
 * Todo arquivo do código-fonte precisa estar no git.
 *
 * `.gitignore` tinha `data/` sem barra inicial, para o store em arquivo que
 * não existe mais. Sem a barra o padrão casa com **qualquer** pasta chamada
 * data, e engoliu `src/data/` inteira — inclusive o changelog, que a modal
 * importa.
 *
 * O modo de falha é o pior possível: o arquivo existe na máquina, `tsc`
 * passa, os testes passam e o `vite build` passa. Quebra só no deploy, num
 * import de um arquivo que nunca foi enviado.
 */
describe('nada do código-fonte fica de fora do git', () => {
  it('nenhum arquivo de src ou api está ignorado', () => {
    const fontes = [...varrer('src'), ...varrer('api')];

    const ignorados = fontes.filter((arquivo) => {
      const r = spawnSync('git', ['check-ignore', '-q', arquivo]);
      return r.status === 0;
    });

    expect(ignorados).toEqual([]);
  });
});

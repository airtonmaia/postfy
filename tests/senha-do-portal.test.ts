import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios, semComentariosSql } from './util/semComentarios';
import {
  gerarSenhaDoPortal,
  senhaCurta,
  ALFABETO_DA_SENHA,
  TAMANHO_MINIMO_DA_SENHA,
} from '../src/lib/senhas';

/**
 * Entrar no portal com e-mail e senha.
 *
 * O código de seis dígitos continua existindo e continua sendo a porta de
 * saída — o que ele deixou de ser é o único caminho. Ele depende de a
 * mensagem sair da fila, chegar, não cair em spam e a pessoa achar; do outro
 * lado está um cliente que quer aprovar um post, e cada minuto de espera é
 * uma aprovação que não acontece hoje.
 *
 * As guardas aqui se dividem em duas: o gerador é **puro**, então ele é
 * exercitado de verdade; o resto é decisão que só existe no banco e na
 * fronteira da rota, e aí a guarda lê a fonte.
 */

const RAIZ = join(__dirname, '..');
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), 'utf-8'));

const migracao = semComentariosSql(
  readFileSync(join(RAIZ, 'supabase', 'migrations', '20260921120000_senha_no_portal.sql'), 'utf-8')
);
/**
 * O corpo de **uma** função, e não os N caracteres seguintes ao nome dela.
 *
 * **A primeira versão destas guardas recortava com `slice(0, 1400)`, e ela
 * passou com o bug dentro.** Tirando a conferência de papel de
 * `definir_senha_do_portal`, a janela de 1400 caracteres alcançava a função
 * seguinte — `remover_senha_do_portal`, que ainda tinha a dela — e a asserção
 * casava com o **vizinho**. Conferido ao contrário: era isso que acontecia.
 *
 * É a mesma falha das três versões da guarda de formato (`create table[^;]*?
 * jobs\s*\(` caindo dentro da `publish_queue`) e da que fatiava `CreateJobModal`
 * a partir de uma string ausente. O recorte para no terminador da função.
 */
const corpoDaFuncao = (qualificado: string): string => {
  const nome = qualificado.includes('.') ? qualificado : `public.${qualificado}`;
  const inicio = migracao.indexOf(`function ${nome}`);
  expect(inicio, `a função ${nome} sumiu da migração`).toBeGreaterThan(-1);
  const fim = migracao.indexOf('$$;', inicio);
  expect(fim, `a função ${nome} ficou sem terminador`).toBeGreaterThan(inicio);
  return migracao.slice(inicio, fim);
};

const rota = ler('api', 'portal-login.ts');
const telaDeEntrada = ler('src', 'components', 'portal', 'ClientPortalLogin.tsx');
const camadaDeDados = ler('src', 'lib', 'db.ts');

describe('a senha gerada é forte e legível em voz alta', () => {
  it('sai em três grupos de quatro, só com o alfabeto', () => {
    for (let i = 0; i < 200; i += 1) {
      const senha = gerarSenhaDoPortal();
      expect(senha).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      for (const simbolo of senha.replace(/-/g, '')) {
        expect(ALFABETO_DA_SENHA, `símbolo fora do alfabeto: ${simbolo}`).toContain(simbolo);
      }
    }
  });

  it('não tem I, O, 0 nem 1', () => {
    /**
     * Esta senha é lida em voz alta no telefone, colada num WhatsApp e
     * digitada por quem não a escolheu. O par que se confunde é o que vira
     * chamado de "não entra" — e ninguém consegue dizer se o erro foi da
     * senha ou da fonte da tela.
     */
    const amostra = Array.from({ length: 300 }, gerarSenhaDoPortal).join('');
    for (const ambiguo of ['I', 'O', '0', '1']) {
      expect(amostra, `o caractere ambíguo ${ambiguo} voltou ao alfabeto`).not.toContain(ambiguo);
    }
  });

  it('o alfabeto é potência de dois, senão o sorteio enviesa', () => {
    /**
     * **A asserção que importa, e a que nenhuma conferência visual pega.**
     *
     * O símbolo sai de um byte por `b % alfabeto.length`. Com 32 símbolos,
     * 256 divide certo e a distribuição é uniforme. Com 33 — bastaria deixar
     * o `O` entrar —, os primeiros símbolos passam a sair mais vezes que os
     * últimos, e a senha continua **com cara** de aleatória.
     */
    expect(
      ALFABETO_DA_SENHA.length & (ALFABETO_DA_SENHA.length - 1),
      'o alfabeto deixou de ser potência de dois: `% length` sobre um byte passou a enviesar'
    ).toBe(0);
  });

  it('não repete', () => {
    // Gerador preso (constante, relógio, contador) passaria em toda asserção
    // de formato acima e entregaria a mesma senha a todo mundo.
    const senhas = new Set(Array.from({ length: 1000 }, gerarSenhaDoPortal));
    expect(senhas.size).toBe(1000);
  });

  it('usa fonte criptográfica, nunca Math.random', () => {
    const fonte = ler('src', 'lib', 'senhas.ts');
    expect(fonte, 'a senha passou a sair de Math.random').not.toMatch(/Math\.random/);
    expect(fonte).toMatch(/crypto\.getRandomValues/);
  });

  it('o mínimo da tela é o mesmo do banco', () => {
    expect(senhaCurta('a'.repeat(TAMANHO_MINIMO_DA_SENHA - 1))).toBe(true);
    expect(senhaCurta('a'.repeat(TAMANHO_MINIMO_DA_SENHA))).toBe(false);
    // Espaço em volta não conta como caractere — senão " 1234567" passaria.
    expect(senhaCurta(`  ${'a'.repeat(TAMANHO_MINIMO_DA_SENHA - 1)}  `)).toBe(true);

    const minimoDoBanco = migracao.match(/length\(coalesce\(p_senha, ''\)\) < (\d+)/);
    expect(minimoDoBanco?.[1], 'o mínimo do banco e o da tela divergiram').toBe(
      String(TAMANHO_MINIMO_DA_SENHA)
    );
  });
});

describe('o banco guarda bcrypt, e só o servidor confere', () => {
  it('a senha é hasheada com bcrypt, não com o sha256 do código', () => {
    /**
     * `portal_codigos` guarda o código com `digest(..., 'sha256')`, e está
     * certo para o que ele é: seis dígitos, dez minutos e cinco tentativas.
     * Senha é outra coisa — longa, duradoura e reaproveitada em outros
     * lugares. Um sha256 sem sal cai numa tabela arco-íris pronta, e o
     * estrago sairia deste produto para a vida da pessoa.
     */
    expect(migracao, 'a senha deixou de ser bcrypt').toMatch(
      /extensions\.crypt\(p_senha, extensions\.gen_salt\('bf'/
    );
    expect(
      corpoDaFuncao('private.hash_de_senha'),
      'a senha voltou a ser hasheada com digest/sha256'
    ).not.toMatch(/digest\(/);
  });

  it('definir a senha confere o papel na agência dona daquele usuário', () => {
    /**
     * **A guarda central desta entrega.** `definir_senha_do_portal` é
     * `security definer`, então a RLS da tabela não vale dentro dela: sem
     * esta conferência, qualquer sessão autenticada — o dono de outra
     * agência — define a senha do cliente alheio e entra no portal dele.
     *
     * E o papel é conferido na agência **do usuário alvo**, não na que o
     * navegador mandar: é por isso que o `workspace_id` sai da linha lida.
     */
    for (const fn of ['definir_senha_do_portal', 'remover_senha_do_portal']) {
      expect(corpoDaFuncao(fn), `${fn} deixou de conferir o papel na agência`).toMatch(
        /private\.papel_na_agencia\(alvo\.workspace_id\)\) not in \('owner', 'admin', 'manager'\)/
      );
    }
  });

  it('trocar ou tirar a senha derruba as sessões abertas da pessoa', () => {
    // Senha é trocada justamente quando se desconfia de que outra pessoa a
    // tem. Deixar as sessões de pé faria a troca ser decorativa.
    for (const fn of ['definir_senha_do_portal', 'remover_senha_do_portal']) {
      expect(corpoDaFuncao(fn), `${fn} deixou as sessões abertas de pé`).toMatch(
        /delete from public\.portal_sessoes where client_user_id = p_id/
      );
    }
  });

  it('entrar com senha fica fora do alcance do navegador', () => {
    /**
     * É a mesma regra de `portal_conferir_codigo`: sem o limite de taxa da
     * rota na frente, a função é um oráculo de senha chamável direto do
     * navegador de qualquer um.
     */
    expect(migracao, 'portal_entrar_com_senha ficou alcançável pelo navegador').toMatch(
      /revoke all on function public\.portal_entrar_com_senha\(text, text\) from public, anon, authenticated/
    );
    expect(migracao).toMatch(
      /grant execute on function public\.portal_entrar_com_senha\(text, text\) to service_role/
    );
    expect(
      migracao,
      'portal_entrar_com_senha ganhou EXECUTE para anon ou authenticated'
    ).not.toMatch(/grant execute on function public\.portal_entrar_com_senha[^;]*to (anon|authenticated)/);
  });

  it('a tentativa errada é contada no banco, não só no container', () => {
    // O limite da rota é por container da Vercel, e força bruta não respeita
    // fronteira de container.
    const corpo = corpoDaFuncao('portal_entrar_com_senha');
    expect(corpo, 'o contador de tentativas sumiu').toMatch(/tentativas_de_senha = candidato\.tentativas_de_senha \+ 1/);
    expect(corpo, 'o bloqueio por tentativas sumiu').toMatch(/bloqueado_ate = case/);
    expect(corpo, 'quem está bloqueado voltou a ser conferido').toMatch(
      /candidato\.bloqueado_ate > now\(\) then\s*continue/
    );
  });

  it('o mesmo e-mail em dois clientes é percorrido, não decidido pelo mais antigo', () => {
    /**
     * O índice único de `client_users` é por cliente: uma agência que atende
     * duas empresas do mesmo dono tem o mesmo e-mail duas vezes, com senhas
     * diferentes. Pegar só o mais antigo faria a senha certa do segundo ser
     * recusada sem explicação nenhuma.
     */
    expect(
      corpoDaFuncao('portal_entrar_com_senha'),
      'a busca voltou a testar um candidato só'
    ).toMatch(/for candidato in[\s\S]*?loop/);
  });
});

describe('a rota é a única porta, e o código continua atrás dela', () => {
  it('a ação de senha passa pelo limite de taxa antes do banco', () => {
    const acao = rota.slice(rota.indexOf("if (acao === 'senha')"));
    const limite = acao.indexOf('excedeuLimite(');
    const chamada = acao.indexOf('portal_entrar_com_senha');
    expect(limite, 'a ação de senha perdeu o limite de taxa').toBeGreaterThan(-1);
    expect(limite, 'o limite de taxa passou a vir depois da consulta ao banco').toBeLessThan(
      chamada
    );
  });

  it('o erro não distingue e-mail inexistente de senha errada', () => {
    /**
     * Distinguir contaria quem é cliente de quem — a mesma razão de a
     * resposta de `enviar` ser sempre igual. E distinguir o bloqueio diria
     * ao atacante que ele acertou o alvo e só precisa esperar.
     */
    const acao = rota.slice(rota.indexOf("if (acao === 'senha')"));
    expect(acao.slice(0, 1600)).toMatch(/E-mail ou senha incorretos\./);
    expect(acao.slice(0, 1600), 'a rota passou a dizer qual dos dois falhou').not.toMatch(
      /não encontrado|não existe|bloquead/i
    );
  });

  it('a porta de saída do código continua na tela de entrada', () => {
    /**
     * **Sem isto, quem nunca recebeu senha fica trancado do lado de fora.**
     * O código é o caminho de quem esqueceu a senha, de quem nunca teve uma
     * e de quem o banco bloqueou por tentativas — e não há ninguém a quem
     * recorrer no domingo à noite, que é quando a aprovação acontece.
     */
    expect(telaDeEntrada, 'a entrada por código sumiu da tela do portal').toMatch(
      /portalApi\.enviarCodigo/
    );
    expect(telaDeEntrada, 'a tela deixou de oferecer o código a quem não tem senha').toMatch(
      /receber código por e-mail/i
    );
  });
});

describe('o hash nunca chega ao navegador', () => {
  it('nenhuma consulta do app seleciona senha_hash', () => {
    /**
     * A consulta era `select('*')`, e no dia em que a senha entrou na tabela
     * o `*` passaria a trazer o bcrypt de cada pessoa para o navegador de
     * quem abre a ficha do cliente. Não é escalada de privilégio — quem abre
     * essa tela pode definir a senha —, mas hash no bundle é material para
     * ataque offline, e o `*` não avisa quando a tabela ganha coluna nova.
     */
    expect(camadaDeDados, 'a lista de usuários do cliente voltou ao select(*)').toMatch(
      /from\('client_users'\)\s*\.select\(COLUNAS_DO_USUARIO_DO_CLIENTE\)/
    );
    expect(
      camadaDeDados.slice(camadaDeDados.indexOf('COLUNAS_DO_USUARIO_DO_CLIENTE =')).slice(0, 400),
      'senha_hash entrou na lista de colunas lidas'
    ).not.toMatch(/senha_hash/);

    const arquivos = readdirSync(join(RAIZ, 'src', 'lib')).filter((f) => f.endsWith('.ts'));
    for (const arquivo of arquivos) {
      expect(
        ler('src', 'lib', arquivo),
        `${arquivo} passou a ler senha_hash no cliente`
      ).not.toMatch(/senha_hash/);
    }
  });

  it('o mapper carrega a data, não o hash', () => {
    const mappers = ler('src', 'lib', 'mappers.ts');
    expect(mappers).toMatch(/senhaDefinidaEm: ounull\(l\.senha_definida_em\)/);
    expect(mappers, 'o hash entrou no tipo que a tela usa').not.toMatch(/senha_hash/);
  });
});

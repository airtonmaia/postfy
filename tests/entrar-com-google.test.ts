import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Entrar com Google.
 *
 * O botão é a parte fácil. O que custa é a **volta**: o login termina numa
 * página que não é a nossa, então não existe retorno de chamada que a tela
 * possa ler — quando o navegador volta, o app monta do zero, e é o
 * carregamento da sessão que precisa perceber que há alguém autenticado sem
 * agência nenhuma.
 *
 * Sem isso, `carregarSessao` devolve `null` (que é o mesmo que ela devolve
 * para quem não entrou), a tela de login aparece de novo — **idêntica** —, e a
 * pessoa clica em Google outra vez, para sempre. Nada local acusa: `tsc`
 * compila, o vitest não monta componente e o build não faz login. É a família
 * da armadilha 0, e por isso a guarda é sobre o código.
 */
describe('entrar com Google', () => {
  const auth = readFileSync('src/lib/authSupabase.ts', 'utf-8');
  const contexto = readFileSync('src/context/PostfyContext.tsx', 'utf-8');
  const tela = readFileSync('src/components/auth/LoginView.tsx', 'utf-8');
  const logo = readFileSync('src/components/common/LogoDoGoogle.tsx', 'utf-8');

  /**
   * Recorta uma função a partir do nome dela, parando no próximo declarado no
   * mesmo nível.
   *
   * Fatia de tamanho fixo mede o vizinho: já aconteceu aqui três vezes — a
   * guarda da senha do portal com `slice(0, 1400)` passou com o bug dentro,
   * porque a janela alcançava a função seguinte, que ainda tinha a
   * conferência.
   */
  const corpoDe = (fonte: string, inicio: string, fim: RegExp): string => {
    const de = fonte.indexOf(inicio);
    expect(de, `não achei ${inicio}`).toBeGreaterThan(-1);
    const resto = fonte.slice(de + inicio.length);
    const ate = resto.search(fim);
    return resto.slice(0, ate === -1 ? resto.length : ate);
  };

  it('o login sai pelo fluxo OAuth do próprio cliente do Supabase', () => {
    const corpo = corpoDe(auth, 'export const entrarComGoogle', /\nexport const /);
    expect(corpo).toContain("provider: 'google'");
    expect(corpo).toContain('signInWithOAuth');
    // Sem endereço de volta o Supabase usa a Site URL do projeto, que não é
    // necessariamente o domínio de onde a pessoa clicou (preview da Vercel,
    // localhost) — e ela terminaria logada em outro lugar.
    expect(corpo).toContain('redirectTo');
  });

  /**
   * A guarda que importa: a volta cria a agência de quem chega pela primeira
   * vez.
   *
   * A ordem é parte da regra — `garantirAgencia` depois de `carregarSessao`
   * falhar (para não custar uma consulta a mais no caminho normal) e **antes**
   * de `aplicarSessao`, que é quem decide se a pessoa vê o app ou a tela de
   * login.
   */
  it('sessão sem agência passa por garantirAgencia antes de virar tela', () => {
    const corpo = corpoDe(contexto, 'const recarregarSessao = async', /\n  \/\/ Restaura ao abrir/);

    expect(corpo).toContain('temSessaoAberta');
    expect(corpo).toContain('garantirAgencia');

    const pediuAgencia = corpo.indexOf('garantirAgencia');
    const aplicou = corpo.indexOf('aplicarSessao(sessao)');
    expect(aplicou).toBeGreaterThan(-1);
    expect(pediuAgencia).toBeLessThan(aplicou);

    // E a sessão é relida depois de criar a agência: sem a segunda leitura o
    // vínculo existe no banco e o app segue com o `null` da primeira.
    const releu = corpo.lastIndexOf('carregarSessao(lastWorkspaceId)');
    expect(releu).toBeGreaterThan(pediuAgencia);
  });

  /**
   * Quem tem convite pendente não ganha agência — `garantirAgencia` recusa, de
   * propósito. Esse caso só não vira um beco sem saída porque o motivo chega à
   * tela.
   */
  it('o motivo de não ter entrado chega à tela de login', () => {
    expect(contexto).toContain('avisoDaEntrada');
    expect(contexto).toMatch(/setAvisoDaEntrada\(\s*criada\.sucesso/);
    expect(tela).toContain('avisoDaEntrada');
    // Não basta receber: tem que ser renderizado.
    expect(tela).toMatch(/\{errorMsg \|\| avisoDaEntrada\}/);
  });

  /**
   * Provedor desligado é o estado de estreia deste botão, e a mensagem crua do
   * Supabase ("Unsupported provider") faz quem clica concluir que o produto
   * está quebrado. Mesma regra da aba Integrações: diz o que falta e onde.
   */
  it('provedor desligado vira instrução, não erro cru', () => {
    const corpo = corpoDe(auth, 'const traduzir', /\n\/\*\*/);
    expect(corpo).toContain('provider is not enabled');
    expect(corpo).toMatch(/Supabase/);
  });

  /**
   * O nome e a foto que o Google manda vêm em chaves próprias. Lendo só as
   * nossas, toda conta do Google entra chamada pelo começo do e-mail e sem
   * foto — logo depois de a pessoa ter autorizado justamente o acesso ao
   * perfil.
   */
  it('o perfil do provedor é lido nas chaves que ele usa', () => {
    const nome = corpoDe(auth, 'const nomeDoMetadado', /\nconst avatarDoMetadado/);
    expect(nome).toContain('full_name');
    expect(nome).toContain('name');
    // `nome` primeiro: quem editou o perfil aqui dentro não pode ver o nome do
    // Google voltar no login seguinte.
    expect(nome.indexOf('nome')).toBeLessThan(nome.indexOf('full_name'));

    const avatar = corpoDe(auth, 'const avatarDoMetadado', /\n\/\*\*/);
    expect(avatar).toContain('avatar_url');
    expect(avatar).toContain('picture');

    // E quem lê o metadado usa os dois helpers, em vez de voltar ao acesso
    // direto que existia antes.
    const sessao = corpoDe(auth, 'export const carregarSessao', /\nexport const aoMudarAutenticacao/);
    expect(sessao).toContain('nomeDoMetadado(metadados)');
    expect(sessao).toContain('avatarDoMetadado(metadados)');
    expect(sessao).not.toMatch(/metadados\.(nome|avatar)\b/);
  });

  /**
   * O botão fica só na aba de login.
   *
   * Em "Nova Agência" a pessoa digita o nome da agência, e o Google não tem
   * como carregá-lo na ida: a conta nasceria com o nome padrão e o que ela
   * escreveu sumiria sem aviso. É a tela oferecendo mais do que o caminho
   * honra — a família de bug que este produto já pagou no `feed_story`, no
   * `|| midia` do story e na fila sem produtor.
   */
  it('o cadastro de agência não oferece o atalho do Google', () => {
    const formularioDeCadastro = corpoDe(
      tela,
      "{activeMode === 'register' && (",
      /Footer Terms & Policy/
    );
    expect(formularioDeCadastro).not.toContain('handleGoogleLogin');
  });

  /** O "G" colorido é o que faz o botão ser reconhecido de relance. */
  it('o botão leva a marca do Google, não um ícone genérico', () => {
    expect(tela).toContain('LogoDoGoogle');
    for (const cor of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) {
      expect(logo).toContain(cor);
    }
  });
});

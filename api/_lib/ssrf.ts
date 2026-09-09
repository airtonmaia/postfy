import { lookup } from 'dns/promises';
import net from 'net';

/**
 * Proteção contra SSRF em URLs fornecidas pelo usuário.
 *
 * O disparo de webhook parte do servidor da aplicação. Sem esta checagem,
 * qualquer usuário autenticado poderia apontar o teste para 127.0.0.1, para a
 * faixa interna da VPC ou para 169.254.169.254 (metadados da nuvem, onde vivem
 * credenciais de instância) e usar o status HTTP devolvido como oráculo.
 */

/** Faixas IPv4 que nunca devem ser alcançadas a partir do servidor. */
const BLOQUEADAS_V4: [string, number][] = [
  ['0.0.0.0', 8],        // "este" host
  ['10.0.0.0', 8],       // privada
  ['100.64.0.0', 10],    // CGNAT
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local, inclui metadados da nuvem
  ['172.16.0.0', 12],    // privada
  ['192.0.0.0', 24],     // IETF
  ['192.0.2.0', 24],     // documentação
  ['192.168.0.0', 16],   // privada
  ['198.18.0.0', 15],    // benchmark
  ['198.51.100.0', 24],  // documentação
  ['203.0.113.0', 24],   // documentação
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // reservada
];

const paraInteiroV4 = (ip: string): number =>
  ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;

const dentroDaFaixaV4 = (ip: string, base: string, bits: number): boolean => {
  if (bits === 0) return true;
  const mascara = (0xffffffff << (32 - bits)) >>> 0;
  return (paraInteiroV4(ip) & mascara) === (paraInteiroV4(base) & mascara);
};

const ehIpv6Bloqueado = (ip: string): boolean => {
  const normalizado = ip.toLowerCase().split('%')[0];

  if (normalizado === '::1' || normalizado === '::') return true;
  // Unique local (fc00::/7) e link-local (fe80::/10)
  if (/^f[cd]/.test(normalizado)) return true;
  if (/^fe[89ab]/.test(normalizado)) return true;

  // IPv4 mapeado em IPv6 (::ffff:127.0.0.1) reintroduz as faixas v4.
  const mapeado = normalizado.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ehIpBloqueado(mapeado[1]);

  return false;
};

export const ehIpBloqueado = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    return BLOQUEADAS_V4.some(([base, bits]) => dentroDaFaixaV4(ip, base, bits));
  }
  if (net.isIPv6(ip)) {
    return ehIpv6Bloqueado(ip);
  }
  // Não é um IP reconhecível: bloqueia por precaução.
  return true;
};

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
  url?: URL;
}

/**
 * Valida uma URL de destino: esquema, formato e — o que importa de verdade —
 * os endereços para os quais o host resolve.
 */
export const validarUrlExterna = async (bruta: string): Promise<ResultadoValidacao> => {
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    return { ok: false, motivo: 'URL inválida.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, motivo: 'Use uma URL http ou https.' };
  }

  // Credenciais embutidas na URL costumam ser tentativa de confundir o parser.
  if (url.username || url.password) {
    return { ok: false, motivo: 'URL com credenciais embutidas não é aceita.' };
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  // Host que já é um IP: valida direto, sem resolver.
  if (net.isIP(host)) {
    if (ehIpBloqueado(host)) {
      return { ok: false, motivo: 'Endereço de rede interna não é permitido.' };
    }
    return { ok: true, url };
  }

  if (/^localhost$/i.test(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, motivo: 'Endereço de rede interna não é permitido.' };
  }

  let enderecos: { address: string }[];
  try {
    enderecos = await lookup(host, { all: true });
  } catch {
    return { ok: false, motivo: 'Não foi possível resolver o endereço informado.' };
  }

  if (enderecos.length === 0) {
    return { ok: false, motivo: 'O host informado não resolve para nenhum endereço.' };
  }

  // Basta um endereço interno para recusar: um host pode resolver para vários.
  const interno = enderecos.find((e) => ehIpBloqueado(e.address));
  if (interno) {
    return { ok: false, motivo: 'Endereço de rede interna não é permitido.' };
  }

  return { ok: true, url };
};

/**
 * Requisição a um destino externo com as travas de SSRF aplicadas.
 *
 * Redirecionamentos não são seguidos automaticamente: um 302 para
 * http://169.254.169.254 contornaria toda a validação acima. Cada salto é
 * revalidado, com um teto de saltos.
 *
 * Limitação conhecida: entre a resolução de DNS e a conexão existe uma janela
 * de DNS rebinding. Fechá-la exige conectar ao IP já validado com o Host
 * original (agente HTTP customizado). Para um disparo de teste manual,
 * autenticado e com rate limit, o risco residual é aceitável; para disparos
 * automáticos em produção, vale endereçar.
 */
export const buscarComProtecao = async (
  urlInicial: string,
  init: RequestInit,
  maxSaltos = 3
): Promise<Response> => {
  let alvo = urlInicial;

  for (let salto = 0; salto <= maxSaltos; salto++) {
    const validacao = await validarUrlExterna(alvo);
    if (!validacao.ok) {
      throw Object.assign(new Error(validacao.motivo || 'Destino não permitido.'), {
        code: 'DESTINO_BLOQUEADO',
      });
    }

    const resposta = await fetch(validacao.url!.toString(), {
      ...init,
      redirect: 'manual',
    });

    const ehRedirecionamento = resposta.status >= 300 && resposta.status < 400;
    const destino = resposta.headers.get('location');

    if (!ehRedirecionamento || !destino) {
      return resposta;
    }

    if (salto === maxSaltos) {
      throw Object.assign(new Error('Excesso de redirecionamentos.'), {
        code: 'MUITOS_REDIRECIONAMENTOS',
      });
    }

    alvo = new URL(destino, validacao.url!).toString();
  }

  throw Object.assign(new Error('Excesso de redirecionamentos.'), {
    code: 'MUITOS_REDIRECIONAMENTOS',
  });
};

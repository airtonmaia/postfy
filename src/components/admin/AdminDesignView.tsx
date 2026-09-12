import React, { useEffect, useState } from 'react';
import {
  Palette,
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import {
  carregarAparenciaComoAdmin,
  salvarAparencia,
  APARENCIA_PADRAO,
  type AparenciaDoSaas,
} from '../../lib/aparencia';
import { CampoDeImagem } from './CampoDeImagem';
import { MarcaOrquesia } from '../common/MarcaOrquesia';
import { Button } from '../ui/button';

/**
 * A cara do Orquesia, editável sem deploy.
 *
 * Antes tudo isto era literal dentro dos componentes: a foto da tela de
 * entrada, o texto ao lado dela, o roxo. Trocar a imagem de fundo era abrir
 * PR e esperar build.
 *
 * O que esta tela **não** faz, e diz que não faz: repintar o app inteiro de
 * uma agência. Dentro da agência quem manda é o whitelabel dela — é para isso
 * que ele existe. A paleta daqui vale onde não há agência: a tela de entrada,
 * a porta do portal antes de saber de quem é o link, e esta própria área.
 * Prometer mais seria a mesma mentira do Financeiro que somava agências
 * vezes R$ 197.
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

const Secao: React.FC<{
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}> = ({ titulo, descricao, children }) => (
  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
    <div>
      <h2 className="text-sm font-black text-slate-900 dark:text-white">{titulo}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
        {descricao}
      </p>
    </div>
    {children}
  </section>
);

const CampoDeCor: React.FC<{
  rotulo: string;
  ajuda: string;
  valor: string;
  aoMudar: (v: string) => void;
}> = ({ rotulo, ajuda, valor, aoMudar }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{rotulo}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#000000'}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer shrink-0"
      />
      <input
        type="text"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="#7c3aed"
        className={`${CAMPO} font-mono`}
      />
    </div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{ajuda}</p>
  </div>
);

export const AdminDesignView: React.FC = () => {
  const { recarregarAparencia } = usePostfy();

  const [form, setForm] = useState<AparenciaDoSaas | null>(null);
  const [original, setOriginal] = useState<AparenciaDoSaas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarAparenciaComoAdmin()
      .then((a) => {
        if (!ativo) return;
        setForm(a);
        setOriginal(a);
      })
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      ativo = false;
    };
  }, []);

  const mudar = <K extends keyof AparenciaDoSaas>(campo: K, valor: AparenciaDoSaas[K]) => {
    setSalvo(false);
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
  };

  const texto = (campo: keyof AparenciaDoSaas): string =>
    (form?.[campo] as string | null) ?? '';

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarAparencia(form);
      // A tela de entrada e a porta do portal leem do contexto: sem recarregar,
      // o que acabou de ser salvo só apareceria no próximo F5.
      await recarregarAparencia();
      setOriginal(form);
      setSalvo(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // O banco recusa cor fora de #rrggbb e endereço que não seja http(s) ou
      // caminho da própria origem. A mensagem crua do Postgres não ajuda quem
      // está na tela.
      setErro(
        /saas_settings_cores_hex/.test(msg)
          ? 'Alguma cor não está no formato #rrggbb. Corrija e salve de novo.'
          : /saas_settings_urls_http/.test(msg)
            ? 'Algum endereço de imagem não começa com https:// nem com /. Corrija e salve de novo.'
            : msg
      );
    } finally {
      setSalvando(false);
    }
  };

  if (erro && !form) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 flex items-start gap-3 max-w-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Não foi possível ler a configuração do produto
            </p>
            <p className="text-xs text-rose-800 dark:text-rose-300/90 mt-1 leading-relaxed">{erro}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  const mudou = JSON.stringify(form) !== JSON.stringify(original);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Design do produto
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Marca, paleta e telas de entrada
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            O que está aqui é a cara do Orquesia. O whitelabel de cada agência continua
            em Configurações → Whitelabel, e é ele que pinta o portal dos clientes dela.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mudou && (
            <Button variant="secondary" size="lg"
              type="button"
              onClick={() => {
                setForm(original);
                setSalvo(false);
              }}

            >
              <RotateCcw className="w-3.5 h-3.5" />
              Descartar
            </Button>
          )}
          <Button size="lg"
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || !mudou}
          >
            {salvo && !mudou ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {salvando ? 'Salvando...' : salvo && !mudou ? 'Salvo' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      {erro && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{erro}</p>
        </div>
      )}

      <Secao
        titulo="Marca"
        descricao="Aparece na tela de entrada, no cadastro de agência e nesta área. Sem logo enviado, o sistema desenha a marca padrão — que não depende de rede e não quebra se um arquivo sumir."
      >
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Nome do produto
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => mudar('nome', e.target.value)}
              className={CAMPO}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Usado no título da aba e nas telas públicas. Apagar o campo volta para
              “{APARENCIA_PADRAO.nome}”: a coluna não aceita vazio.
            </p>
          </div>

          <div className="flex items-end gap-3 pb-1">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <MarcaOrquesia tamanho={32} />
              )}
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {form.nome || APARENCIA_PADRAO.nome}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 pb-2">prévia</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <CampoDeImagem
            rotulo="Logo (fundo claro)"
            ajuda="Quadrado, PNG ou SVG com fundo transparente."
            formato="marca"
            valor={texto('logoUrl')}
            aoMudar={(v) => mudar('logoUrl', v || null)}
          />
          <CampoDeImagem
            rotulo="Logo (fundo escuro)"
            ajuda="Só é usada no tema escuro. Sem ela, vale a de cima."
            formato="marca"
            valor={texto('logoEscuroUrl')}
            aoMudar={(v) => mudar('logoEscuroUrl', v || null)}
          />
          <CampoDeImagem
            rotulo="Favicon"
            ajuda="Ícone da aba do navegador. 32×32 ou 64×64."
            formato="marca"
            valor={texto('faviconUrl')}
            aoMudar={(v) => mudar('faviconUrl', v || null)}
          />
        </div>
      </Secao>

      <Secao
        titulo="Paleta"
        descricao="Vale nas telas em que não há agência: a de entrada, a porta do portal e esta área de administração. Dentro de uma agência quem pinta é o whitelabel dela — é para isso que ele existe, e sobrepor aqui apagaria a marca do cliente."
      >
        <div className="grid md:grid-cols-3 gap-5">
          <CampoDeCor
            rotulo="Primária"
            ajuda="Botões, links e destaques. É a cor que substitui o roxo."
            valor={form.corPrimaria}
            aoMudar={(v) => mudar('corPrimaria', v)}
          />
          <CampoDeCor
            rotulo="Secundária"
            ajuda="Segunda cor dos gradientes e de apoio."
            valor={form.corSecundaria}
            aoMudar={(v) => mudar('corSecundaria', v)}
          />
          <CampoDeCor
            rotulo="Destaque"
            ajuda="Confirmações e indicadores de sucesso."
            valor={form.corDestaque}
            aoMudar={(v) => mudar('corDestaque', v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Prévia:</span>
          <span
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: form.corPrimaria }}
          >
            Botão primário
          </span>
          <span
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
            style={{
              backgroundImage: `linear-gradient(135deg, ${form.corPrimaria}, ${form.corSecundaria})`,
            }}
          >
            Gradiente
          </span>
          <span
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: form.corDestaque }}
          >
            Sucesso
          </span>
        </div>
      </Secao>

      <Secao
        titulo="Tela de entrada da agência"
        descricao="O que quem vai criar uma conta no Orquesia vê primeiro: a foto da coluna esquerda e a chamada por cima dela."
      >
        <CampoDeImagem
          rotulo="Banner"
          ajuda="Foto vertical, porque ocupa a coluna inteira. Sem nada aqui, vale a imagem que já vem no sistema (/portal-hero.jpg)."
          valor={texto('bannerLoginUrl')}
          aoMudar={(v) => mudar('bannerLoginUrl', v || null)}
        />

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Chamada
            </label>
            <input
              type="text"
              value={texto('tituloLogin')}
              onChange={(e) => mudar('tituloLogin', e.target.value || null)}
              placeholder="Sua agência de conteúdo em outro nível."
              className={CAMPO}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Linha de apoio
            </label>
            <input
              type="text"
              value={texto('subtituloLogin')}
              onChange={(e) => mudar('subtituloLogin', e.target.value || null)}
              placeholder="Fluxos de aprovação com clientes, pautas editoriais e inteligência artificial."
              className={CAMPO}
            />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Porta do Portal do Cliente"
        descricao="A tela onde o cliente da agência pede o código por e-mail. Ela é whitelabel: o logo e o nome ali são os da agência dona do link. O que se define aqui é a arte de fundo e os textos, que valem para todas."
      >
        <CampoDeImagem
          rotulo="Banner"
          ajuda="Ocupa a coluna direita da porta do portal. Sem nada aqui, vale /portal-hero.jpg."
          valor={texto('bannerPortalUrl')}
          aoMudar={(v) => mudar('bannerPortalUrl', v || null)}
        />

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Chamada
            </label>
            <input
              type="text"
              value={texto('tituloPortal')}
              onChange={(e) => mudar('tituloPortal', e.target.value || null)}
              placeholder="Aprove seu conteúdo em um só lugar."
              className={CAMPO}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Linha de apoio
            </label>
            <input
              type="text"
              value={texto('subtituloPortal')}
              onChange={(e) => mudar('subtituloPortal', e.target.value || null)}
              placeholder="Sem senha: o código chega no seu e-mail."
              className={CAMPO}
            />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Contato e obrigações legais"
        descricao="Aparecem no rodapé das telas públicas. Vazios, o rodapé não mostra o link — melhor do que um endereço que leva a lugar nenhum."
      >
        <div className="grid md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              E-mail de suporte
            </label>
            <input
              type="email"
              value={texto('emailSuporte')}
              onChange={(e) => mudar('emailSuporte', e.target.value || null)}
              placeholder="suporte@orquesia.com.br"
              className={CAMPO}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Termos de uso
            </label>
            <input
              type="text"
              value={texto('urlTermos')}
              onChange={(e) => mudar('urlTermos', e.target.value || null)}
              placeholder="https://orquesia.com.br/termos"
              className={CAMPO}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Política de privacidade
            </label>
            <input
              type="text"
              value={texto('urlPrivacidade')}
              onChange={(e) => mudar('urlPrivacidade', e.target.value || null)}
              placeholder="https://orquesia.com.br/privacidade"
              className={CAMPO}
            />
          </div>
        </div>
      </Secao>

      <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Onde cada coisa aparece
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            A marca e a paleta valem nas telas sem agência: entrada, cadastro, porta do
            portal e esta área. Dentro de uma agência, o whitelabel dela sobrepõe a
            paleta — de propósito, porque é o cliente dela que vê aquela tela. Os
            banners e os textos são do produto e valem em toda parte.
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Enviar arquivo depende do R2 configurado (<code className="font-mono">R2_BUCKET</code>,{' '}
            <code className="font-mono">R2_PUBLIC_BASE_URL</code> e as chaves). Sem isso, o
            envio falha dizendo o que falta e o campo de endereço continua funcionando.
          </p>
        </div>
      </div>
    </div>
  );
};

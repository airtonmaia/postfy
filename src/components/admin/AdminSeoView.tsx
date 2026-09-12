import React, { useEffect, useState } from 'react';
import {
  Search,
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';

import { usePostfy } from '../../context/PostfyContext';
import {
  carregarAparenciaComoAdmin,
  salvarAparencia,
  type AparenciaDoSaas,
} from '../../lib/aparencia';
import { CampoDeImagem } from './CampoDeImagem';
import { Button } from '../ui/button';

/**
 * O que os buscadores e as prévias de link mostram do Orquesia.
 *
 * Esta tela existe com uma ressalva escrita nela, e é a parte que importa: o
 * app é uma SPA servida estática. Meta tag injetada por JavaScript alcança o
 * navegador e o Google (que executa JS); **não** alcança o robô do WhatsApp,
 * do Facebook, do LinkedIn ou do Slack, que baixam o HTML cru e vão embora.
 *
 * Por isso o que se salva aqui vai por dois caminhos: `SeoDoSaas` escreve as
 * tags na página, e `api/seo.ts` responde aos robôs de prévia, desviados pelo
 * user-agent em `vercel.json`. Sem o segundo, a tela prometeria uma prévia
 * bonita no WhatsApp e entregaria um retângulo cinza — do mesmo tipo de
 * mentira que o Financeiro contava somando agências vezes R$ 197.
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

/** Limites que o Google costuma cortar. Não são regra, são o que cabe. */
const LIMITE_TITULO = 60;
const LIMITE_DESCRICAO = 160;

const Contador: React.FC<{ atual: number; limite: number }> = ({ atual, limite }) => (
  <span
    className={`text-[10px] font-mono font-bold ${
      atual > limite ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
    }`}
  >
    {atual}/{limite}
  </span>
);

export const AdminSeoView: React.FC = () => {
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

  const texto = (campo: keyof AparenciaDoSaas): string => (form?.[campo] as string | null) ?? '';

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarAparencia(form);
      await recarregarAparencia();
      setOriginal(form);
      setSalvo(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(
        /saas_settings_urls_http/.test(msg)
          ? 'A imagem de prévia ou o endereço canônico não começa com https://. Corrija e salve de novo.'
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
  const nome = form.nome || 'Orquesia';
  const tituloEfetivo = form.seoTitulo || `${nome} — gestão de agências de conteúdo`;
  const descricaoEfetiva =
    form.seoDescricao ||
    `${nome} organiza pautas, aprovações e produção de conteúdo da sua agência num lugar só.`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Apresentação nos buscadores
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            SEO e prévia de link
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            O que aparece na busca do Google e no cartão que o WhatsApp monta quando
            alguém manda o endereço do Orquesia.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mudou && (
            <Button variant="secondary"
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
          <Button
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

      {/*
        A ressalva vem antes dos campos, e não num rodapé: quem preenche
        precisa saber por onde cada valor sai antes de escrever qualquer coisa.
      */}
      <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Por onde isto chega em quem lê
        </p>
        <ul className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1 max-w-3xl list-disc pl-4">
          <li>
            <strong>Navegador e Google:</strong> as tags são escritas na página quando ela
            abre. O Google executa JavaScript, então enxerga o que está aqui.
          </li>
          <li>
            <strong>Prévia de link (WhatsApp, Facebook, LinkedIn, Slack):</strong> esses robôs
            baixam o HTML e vão embora antes de qualquer script rodar. Para eles a Vercel
            desvia pelo user-agent para <code className="font-mono">/api/seo</code>, que lê
            os mesmos campos e devolve as tags prontas.
          </li>
          <li>
            <strong>O que isto não faz:</strong> ranquear o produto. As telas internas são
            atrás de login e não têm o que indexar — o que vai para a busca é a porta de
            entrada, e só.
          </li>
        </ul>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Título</label>
                <Contador atual={tituloEfetivo.length} limite={LIMITE_TITULO} />
              </div>
              <input
                type="text"
                value={texto('seoTitulo')}
                onChange={(e) => mudar('seoTitulo', e.target.value || null)}
                placeholder={`${nome} — gestão de agências de conteúdo`}
                className={CAMPO}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Vazio, vale o texto do exemplo, montado com o nome do produto.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Descrição
                </label>
                <Contador atual={descricaoEfetiva.length} limite={LIMITE_DESCRICAO} />
              </div>
              <textarea
                rows={3}
                value={texto('seoDescricao')}
                onChange={(e) => mudar('seoDescricao', e.target.value || null)}
                placeholder={descricaoEfetiva}
                className={`${CAMPO} resize-none leading-relaxed`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Endereço canônico
              </label>
              <input
                type="text"
                value={texto('seoUrlCanonica')}
                onChange={(e) => mudar('seoUrlCanonica', e.target.value || null)}
                placeholder="https://app.orquesia.com.br"
                className={CAMPO}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Com domínio, sempre. É o endereço que o buscador considera o oficial quando
                o mesmo conteúdo abre por mais de um caminho.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Palavras-chave
              </label>
              <input
                type="text"
                value={texto('seoPalavras')}
                onChange={(e) => mudar('seoPalavras', e.target.value || null)}
                placeholder="agência de conteúdo, aprovação de posts, calendário editorial"
                className={CAMPO}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                O Google ignora esta tag há anos. Fica porque outros buscadores e
                ferramentas internas ainda a leem — não espere efeito na busca.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <CampoDeImagem
              rotulo="Imagem da prévia"
              ajuda="1200×630. É a foto do cartão que aparece quando alguém manda o link no WhatsApp ou no LinkedIn."
              valor={texto('seoImagemUrl')}
              aoMudar={(v) => mudar('seoImagemUrl', v || null)}
            />

            {/* Prévia montada com os mesmos campos que a rota devolve. */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Como o cartão fica
              </span>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                {form.seoImagemUrl ? (
                  <img src={form.seoImagemUrl} alt="" className="w-full aspect-[1200/630] object-cover" />
                ) : (
                  <div className="w-full aspect-[1200/630] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-[11px] text-slate-400">sem imagem: o cartão vem só com texto</span>
                  </div>
                )}
                <div className="p-3 space-y-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    {(form.seoUrlCanonica || 'app.orquesia.com.br').replace(/^https?:\/\//, '')}
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                    {tituloEfetivo}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                    {descricaoEfetiva}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Indexação</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">
            Controla a tag <code className="font-mono">robots</code> da página e o conteúdo de{' '}
            <code className="font-mono">/robots.txt</code>, que é servido pela mesma rota. As
            telas internas ficam de fora nos dois casos — um resultado de busca que devolve a
            tela de login não serve para ninguém.
          </p>
        </div>

        <button
          type="button"
          onClick={() => mudar('seoIndexar', !form.seoIndexar)}
          className={`flex items-center gap-3 w-full sm:w-auto px-4 py-3 rounded-xl border text-left transition cursor-pointer ${
            form.seoIndexar
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
        >
          {form.seoIndexar ? (
            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {form.seoIndexar ? 'Aparece nos buscadores' : 'Fora dos buscadores'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {form.seoIndexar
                ? 'A porta de entrada pode ser indexada.'
                : 'robots.txt bloqueia tudo e a página pede noindex.'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 pt-1">
          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <a
            href="/robots.txt"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
          >
            Ver o /robots.txt que está no ar
          </a>
        </div>
      </section>
    </div>
  );
};

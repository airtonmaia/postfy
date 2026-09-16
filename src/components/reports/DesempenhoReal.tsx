import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Heart, MessageCircle, Bookmark, Share2, ExternalLink, Info } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { safeDateTimeFormat, safeDateFormat } from '../../lib/utils';
import {
  carregarMetricas,
  agregar,
  medicaoMaisAntiga,
  formatarNumero,
  type MetricaDePost,
} from '../../lib/metricas';

const CAMPOS = [
  { campo: 'alcance', rotulo: 'Alcance', icone: Eye },
  { campo: 'curtidas', rotulo: 'Curtidas', icone: Heart },
  { campo: 'comentarios', rotulo: 'Comentários', icone: MessageCircle },
  { campo: 'salvamentos', rotulo: 'Salvamentos', icone: Bookmark },
  { campo: 'compartilhamentos', rotulo: 'Compartilhamentos', icone: Share2 },
] as const;

/**
 * O que o conteúdo publicado deu — alcance, curtidas, salvamentos.
 *
 * O resto do Relatórios mede **produção**: quantas peças, prazos cumpridos, o
 * que está atrasado. É o que responde como a agência trabalha, e não é o que o
 * cliente dela pergunta ao ler o relatório.
 *
 * **Cobre só o que saiu pela fila do Orquesia**, e a tela diz isso: post
 * publicado à mão no Instagram não tem como ser associado a um conteúdo daqui.
 * Omitir esse recorte faria o número parecer o desempenho do perfil inteiro.
 */
export const DesempenhoReal: React.FC<{
  desde: Date;
  ate: Date;
  clientId: string;
}> = ({ desde, ate, clientId }) => {
  const { clients } = usePostfy();

  const [linhas, setLinhas] = useState<MetricaDePost[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);

    carregarMetricas(desde, ate)
      .then((dados) => vivo && setLinhas(dados))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao ler as métricas.'))
      .finally(() => vivo && setCarregando(false));

    return () => {
      vivo = false;
    };
  }, [desde.getTime(), ate.getTime()]);

  const visiveis = useMemo(
    () => (clientId === 'all' ? linhas : linhas.filter((l) => l.clientId === clientId)),
    [linhas, clientId]
  );

  const medidoEm = useMemo(() => medicaoMaisAntiga(visiveis), [visiveis]);

  if (erro) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Desempenho real no Instagram
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {carregando
              ? 'Lendo as medições…'
              : visiveis.length === 0
                ? 'Nenhum conteúdo publicado pelo Orquesia neste período'
                : `${visiveis.length} ${visiveis.length === 1 ? 'publicação' : 'publicações'}` +
                  (medidoEm ? ` · medido desde ${safeDateTimeFormat(medidoEm)}` : '')}
          </p>
        </div>
      </div>

      {!carregando && visiveis.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CAMPOS.map(({ campo, rotulo, icone: Icone }) => {
              const { total, medidos } = agregar(visiveis, campo);
              // `medidos === 0` é "ninguém respondeu", e **não** é zero. Somar
              // nulo como zero levaria um número inventado para a reunião com
              // o cliente — é a armadilha 9 na tela que mais custa caro.
              const semMedicao = medidos === 0;

              return (
                <div
                  key={campo}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Icone className="w-3 h-3" />
                    {rotulo}
                  </span>
                  <span
                    className={`block mt-1 text-lg font-bold tabular-nums ${
                      semMedicao
                        ? 'text-slate-300 dark:text-slate-600'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {semMedicao ? '—' : formatarNumero(total)}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {semMedicao
                      ? 'ainda não medido'
                      : medidos === visiveis.length
                        ? 'de todas as publicações'
                        : `de ${medidos} de ${visiveis.length}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-2 font-bold">Publicado</th>
                  <th className="pb-2 font-bold">Cliente</th>
                  {CAMPOS.map(({ campo, rotulo }) => (
                    <th key={campo} className="pb-2 font-bold text-right">
                      {rotulo}
                    </th>
                  ))}
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {visiveis.slice(0, 25).map((linha) => (
                  <tr
                    key={linha.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {linha.publicadoEm ? safeDateFormat(linha.publicadoEm) : '—'}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-300 truncate max-w-32">
                      {clients.find((c) => c.id === linha.clientId)?.name || '—'}
                    </td>
                    {CAMPOS.map(({ campo }) => (
                      <td
                        key={campo}
                        className={`py-2 text-right tabular-nums ${
                          linha[campo] === null
                            ? 'text-slate-300 dark:text-slate-600'
                            : 'text-slate-800 dark:text-slate-200 font-semibold'
                        }`}
                        title={linha[campo] === null ? linha.ultimoErro || 'Ainda não medido' : undefined}
                      >
                        {linha[campo] === null ? '—' : formatarNumero(linha[campo]!)}
                      </td>
                    ))}
                    <td className="py-2 text-right">
                      {linha.permalink && (
                        <a
                          href={linha.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 inline-flex"
                          title="Abrir no Instagram"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* O recorte, sempre à vista. Sem ele o número parece o desempenho do
          perfil inteiro, e a agência responderia pelo que não mediu. */}
      <p className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Cobre apenas o que foi publicado <strong>pela fila do Orquesia</strong> — post feito
          direto no Instagram não entra. Os números são lidos da Meta pelo agendador, em
          passadas, então o traço (—) quer dizer <strong>ainda não medido</strong>, e não zero.
        </span>
      </p>
    </div>
  );
};

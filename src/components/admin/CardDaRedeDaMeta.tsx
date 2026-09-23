import React, { useState } from 'react';
import { AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import type { StatusDoServidor } from '../../lib/api';

/**
 * O cartão de configuração de uma rede da Meta, em Admin → Integrações.
 *
 * **Um desenho só para o Instagram e para o Facebook**, e isso não é economia
 * de linhas: é a história das doze alturas de botão e das sete barras de
 * abas. Duas cópias divergem na primeira pressa, e divergir *aqui* é caro de
 * um jeito específico — este cartão existe para a pessoa cadastrar na Meta
 * exatamente o que o servidor vai pedir. Um cartão que envelhece em relação
 * ao outro ensina a cadastrar errado, e o erro só aparece **depois** de
 * alguém digitar a senha, com uma mensagem da Meta que não nomeia a causa.
 *
 * O que muda entre as duas redes vem por prop: a marca, onde colar no painel
 * da Meta e quais variáveis o servidor precisa ter. O que não muda —
 * a URL de retorno, os avisos de mídia pública e do agendador — mora aqui,
 * porque vale para as duas do mesmo jeito.
 *
 * **Os escopos vêm do servidor**, nunca escritos aqui. Eles saem de
 * `ESCOPOS_INSTAGRAM` e `ESCOPOS_FACEBOOK`, que é o que a autorização
 * realmente manda; uma lista literal nesta tela divergiria sem quebrar nada.
 */
export const CardDaRedeDaMeta: React.FC<{
  /** O ícone da rede, já dimensionado pelo chamador. */
  icone: React.ReactNode;
  /** As classes do quadrado da marca — é a única cor que muda entre as duas. */
  corDaMarca: string;
  nome: string;
  descricao: string;
  /** Onde exatamente colar a URL, no painel da Meta. Muda por rede. */
  ondeColar: React.ReactNode;
  escopos: string[];
  /** Cada variável que o servidor precisa ter, com o que o status respondeu. */
  credenciais: { nome: string; ok: boolean | null }[];
  status: StatusDoServidor | null;
}> = ({ icone, corDaMarca, nome, descricao, ondeColar, escopos, credenciais, status }) => {
  /*
    O estado do "Copiado" é de cada cartão. Compartilhá-lo entre os dois
    acenderia o aviso no cartão errado — a URL é a mesma, mas a pessoa está
    olhando para um deles.
  */
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl text-white shadow-xs ${corDaMarca}`}>{icone}</div>
        <div>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{nome}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{descricao}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          URL de redirecionamento
        </span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {ondeColar}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <code className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono break-all">
            {status?.urlDeRetorno || 'consultando o servidor...'}
          </code>
          <Button
            type="button"
            disabled={!status?.urlDeRetorno}
            onClick={async () => {
              if (!status?.urlDeRetorno) return;
              try {
                await navigator.clipboard.writeText(status.urlDeRetorno);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                /* Sem permissão de área de transferência, o texto está à vista. */
              }
            }}
            className="shrink-0 bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
          >
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Permissões pedidas
          </span>
          <code className="text-[11px] text-slate-700 dark:text-slate-300 font-mono block mt-1 leading-relaxed">
            {escopos.length === 0
              ? 'consultando o servidor...'
              : escopos.map((escopo) => (
                  <React.Fragment key={escopo}>
                    {escopo}
                    <br />
                  </React.Fragment>
                ))}
          </code>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Credenciais no servidor
          </span>
          <code className="text-[11px] text-slate-700 dark:text-slate-300 font-mono block mt-1 leading-relaxed">
            {credenciais.map(({ nome: variavel, ok }) => (
              <React.Fragment key={variavel}>
                {variavel} {ok === null ? '…' : ok ? '✓' : '✗'}
                <br />
              </React.Fragment>
            ))}
          </code>
        </div>
      </div>

      {/*
        As duas armadilhas que não aparecem como erro em lugar nenhum — e
        valem para as duas redes, porque quem baixa a mídia é a Meta e quem
        publica é o mesmo agendador.
      */}
      {status && !status.midiaPublica && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            Falta <code className="font-mono">R2_PUBLIC_BASE_URL</code>. A Meta
            <strong> baixa</strong> a imagem da URL que mandamos, então sem domínio
            público no bucket a publicação falha mesmo com tudo o mais certo.
          </p>
        </div>
      )}
      {status && !status.agendador && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            Falta <code className="font-mono">CRON_SECRET</code> — e ele precisa estar
            nos <strong>dois lugares</strong>: nas variáveis da Vercel e nos segredos do
            repositório no GitHub. Sem os dois, o agendador roda e leva 401 em toda
            passada; a publicação agendada nunca dispara, e nada no app acusa.
          </p>
        </div>
      )}

      <a
        href="https://developers.facebook.com/apps/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
      >
        Abrir o painel de apps da Meta
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};

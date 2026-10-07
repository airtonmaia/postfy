import React, { useEffect, useState } from 'react';
import {
  Building2,
  User,
  Users,
  Activity,
  Globe,
  CreditCard,
  AlertCircle,
  Clock,
} from 'lucide-react';

import {
  carregarDetalhesDaAgencia,
  type DetalhesDaAgencia,
  type PessoaDaAgencia,
} from '../../lib/detalhesDaAgencia';
import { safeDateTimeFormat, formatCurrency } from '../../lib/utils';
import { duracaoLegivel } from '../../lib/historicoDeEtapas';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Avatar } from '../common/Avatar';

/**
 * A ficha da agência: tudo que o banco sabe sobre ela, num lugar só.
 *
 * A lista de Agências respondia nome, slug, tamanho e fuso. A pergunta que o
 * dono do produto faz olhando para ela é outra — *quem abriu isto, quando, de
 * onde, e o que essa pessoa fez depois?* —, e as respostas estavam espalhadas
 * por `workspaces`, `workspace_members`, `auth.users`, `activity_logs` e a
 * auditoria do Supabase, nenhuma delas alcançável pela tela.
 *
 * ### O que a ficha não responde, dito na própria ficha
 *
 * Este é o ponto da tela, não uma ressalva. Três coisas foram pedidas e **não
 * são medidas**, e a tela diz isso em texto em vez de desenhar um campo vazio
 * com cara de dado faltando:
 *
 * - **cidade e país** do IP: traduzir IP em lugar manda o IP de uma pessoa
 *   para um serviço de terceiro. É dado pessoal saindo do produto, e é decisão
 *   de quem é dono dele — não efeito colateral de abrir uma ficha. O IP cru
 *   está aqui; a tradução, não.
 * - **tempo de sessão**: ninguém grava entrada e saída. Subtrair dois
 *   instantes para fabricar uma duração seria inventar um número que vai para
 *   uma decisão — a armadilha que o Financeiro já pagou.
 * - **navegação**: que tela alguém abriu não é registrado. O que existe é o
 *   histórico de **ações**, e é com esse nome que ele aparece.
 *
 * O que está medido aparece inteiro; o que não está aparece nomeado. É a regra
 * do `post_metrics` dentro do `/admin`.
 */

const Bloco: React.FC<{
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}> = ({ titulo, icone, children }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
      {icone}
      {titulo}
    </h4>
    {children}
  </section>
);

const Campo: React.FC<{ rotulo: string; children: React.ReactNode }> = ({
  rotulo,
  children,
}) => (
  <div className="min-w-0">
    <span className="block text-[10px] uppercase font-bold text-slate-400">{rotulo}</span>
    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 break-words">
      {children}
    </span>
  </div>
);

/**
 * `—` quando não há valor, sempre.
 *
 * Campo em branco e campo ausente leem igual numa tela densa, e aqui a
 * diferença entre "não tem" e "não carregou" é a diferença entre uma resposta
 * e um erro silencioso.
 */
const ou = (v?: string | null): string => (v && String(v).trim()) || '—';

const LinhaDaPessoa: React.FC<{ p: PessoaDaAgencia }> = ({ p }) => (
  <div className="flex items-center gap-2.5 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <Avatar nome={p.nome || p.email || '?'} tamanho={28} />
    <div className="min-w-0 flex-1">
      <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
        {ou(p.nome)}
        {p.ativo === false && (
          <span className="ml-1.5 font-normal text-slate-400">(desativado)</span>
        )}
      </span>
      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {ou(p.email)}
      </span>
    </div>
    <div className="text-right shrink-0">
      <Badge tom="neutro">{p.papel}</Badge>
      <span className="block text-[10px] text-slate-400 mt-0.5">
        {p.ultimoAcesso ? `acesso ${safeDateTimeFormat(p.ultimoAcesso)}` : 'nunca entrou'}
      </span>
    </div>
  </div>
);

export const FichaDaAgencia: React.FC<{
  workspaceId: string | null;
  aoFechar: () => void;
}> = ({ workspaceId, aoFechar }) => {
  /* Todos os hooks antes de qualquer `return` — armadilha 8.1. */
  const [dados, setDados] = useState<DetalhesDaAgencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    let vivo = true;
    setCarregando(true);
    setErro(null);
    setDados(null);

    void carregarDetalhesDaAgencia(workspaceId)
      .then((d) => vivo && setDados(d))
      /*
        **Falha de leitura não vira ficha vazia.** Uma ficha sem equipe e sem
        atividade, depois de um erro, diria com cara de certo que a agência não
        tem ninguém e nunca foi usada — que é a frase mais cara que esta tela
        poderia dizer.
      */
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao ler a ficha.'))
      .finally(() => vivo && setCarregando(false));

    return () => {
      vivo = false;
    };
  }, [workspaceId]);

  const a = dados?.agencia;

  return (
    <Dialog open={!!workspaceId} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {workspaceId && (
        <DialogContent tamanho="editor" className="p-0 gap-0">
          <div className="px-5 pr-12 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0">
            <DialogTitle asChild>
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {a ? a.nome : 'Ficha da agência'}
              </h3>
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tudo que o banco registra sobre esta agência.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50 dark:bg-slate-950">
            {carregando && (
              <p className="text-xs text-slate-400 py-10 text-center">Lendo a ficha…</p>
            )}

            {erro && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Não foi possível ler a ficha desta agência. O que está abaixo pode estar
                  incompleto — recarregue antes de concluir qualquer coisa a partir daqui.
                  <span className="block mt-1 font-mono text-[11px] opacity-80">{erro}</span>
                </span>
              </div>
            )}

            {dados && a && (
              <>
                <Bloco titulo="A agência" icone={<Building2 className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Campo rotulo="Nome">{a.nome}</Campo>
                    <Campo rotulo="Slug">@{a.slug}</Campo>
                    <Campo rotulo="Criada em">{ou(a.criadaEm && safeDateTimeFormat(a.criadaEm))}</Campo>
                    <Campo rotulo="Idade">
                      {a.criadaEm
                        ? duracaoLegivel(Date.now() - Date.parse(a.criadaEm))
                        : '—'}
                    </Campo>
                    <Campo rotulo="Fuso">{ou(a.timezone)}</Campo>
                    <Campo rotulo="Domínio próprio">{ou(a.dominio)}</Campo>
                    <Campo rotulo="Whitelabel">{a.whiteLabel ? 'ligado' : 'desligado'}</Campo>
                    <Campo rotulo="Situação">
                      {a.isTrial ? 'marcada como teste' : 'pagante'}
                    </Campo>
                    <Campo rotulo="Teste até">
                      {ou(a.trialEndsAt && safeDateTimeFormat(a.trialEndsAt))}
                    </Campo>
                  </div>

                  {a.excluidaEm && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                      Na lixeira desde {safeDateTimeFormat(a.excluidaEm)}
                      {a.excluidaPor ? `, por ${a.excluidaPor}` : ''}.
                    </p>
                  )}
                </Bloco>

                <Bloco titulo="Quem abriu" icone={<User className="w-3.5 h-3.5" />}>
                  {dados.criador ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Campo rotulo="Nome">{ou(dados.criador.nome)}</Campo>
                      <Campo rotulo="E-mail">{ou(dados.criador.email)}</Campo>
                      <Campo rotulo="Papel hoje">{ou(dados.criador.papel)}</Campo>
                      <Campo rotulo="Entrou na agência">
                        {ou(dados.criador.entrouEm && safeDateTimeFormat(dados.criador.entrouEm))}
                      </Campo>
                      <Campo rotulo="Conta criada em">
                        {ou(
                          dados.criador.contaCriada &&
                            safeDateTimeFormat(dados.criador.contaCriada)
                        )}
                      </Campo>
                      <Campo rotulo="Último acesso">
                        {ou(
                          dados.criador.ultimoAcesso &&
                            safeDateTimeFormat(dados.criador.ultimoAcesso)
                        )}
                      </Campo>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Sem vínculo registrado — a agência está sem membros.
                    </p>
                  )}

                  {/*
                    **Não existe coluna "criada por".** `criar_agencia` faz de
                    quem chama o dono, e o vínculo nasce no mesmo instante da
                    agência. Dizer de onde sai a resposta é o que separa um dado
                    de um palpite com cara de campo.
                  */}
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Quem abriu é o vínculo mais antigo da agência: não há coluna de autoria em
                    `workspaces`, e quem cria vira dono no mesmo instante.
                  </p>
                </Bloco>

                <Bloco titulo={`Equipe (${dados.equipe.length})`} icone={<Users className="w-3.5 h-3.5" />}>
                  {dados.equipe.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum membro.</p>
                  ) : (
                    <div>
                      {dados.equipe.map((p) => (
                        <LinhaDaPessoa key={p.userId} p={p} />
                      ))}
                    </div>
                  )}
                </Bloco>

                <Bloco titulo="Acessos registrados" icone={<Globe className="w-3.5 h-3.5" />}>
                  {!dados.acessosDisponiveis ? (
                    /*
                      Lista vazia e "não dá para ler" leem igual, e dizem coisas
                      opostas: uma afirma que ninguém entrou, a outra que não
                      sabemos. A bandeira vem do banco justamente para esta
                      frase existir.
                    */
                    <p className="text-xs text-slate-400 leading-relaxed">
                      O registro de acessos do Supabase não está acessível neste projeto —
                      isto não quer dizer que ninguém entrou.
                    </p>
                  ) : dados.acessos.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Nenhum acesso no período que o Supabase guarda. O registro é podado:
                      acesso antigo deixa de existir lá.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {dados.acessos.slice(0, 15).map((ac, i) => (
                        <div
                          key={`${ac.quando}-${i}`}
                          className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {ou(ac.email)}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">
                            {ou(ac.acao)}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                            {ou(ac.ip)}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {safeDateTimeFormat(ac.quando)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    O IP é o que o Supabase registra. <strong>Cidade e país não são
                    medidos</strong>: traduzir IP em lugar exige mandar o IP de uma pessoa
                    para um serviço de terceiro, e isso é decisão de quem é dono do produto.
                  </p>
                </Bloco>

                <Bloco titulo="A base" icone={<Activity className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <Campo rotulo="Clientes">{dados.base.clientes}</Campo>
                    <Campo rotulo="Conteúdos">{dados.base.jobs}</Campo>
                    <Campo rotulo="Leads">{dados.base.leads}</Campo>
                    <Campo rotulo="Propostas">{dados.base.propostas}</Campo>
                    <Campo rotulo="Contratos">{dados.base.contratos}</Campo>
                    <Campo rotulo="Materiais">{dados.base.materiais}</Campo>
                    <Campo rotulo="Contas conectadas">{dados.base.conexoes}</Campo>
                  </div>
                </Bloco>

                <Bloco titulo="O que fizeram aqui" icone={<Clock className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Campo rotulo="Ações registradas">{dados.atividade.total}</Campo>
                    <Campo rotulo="Primeira">
                      {ou(dados.atividade.primeira && safeDateTimeFormat(dados.atividade.primeira))}
                    </Campo>
                    <Campo rotulo="Última">
                      {ou(dados.atividade.ultima && safeDateTimeFormat(dados.atividade.ultima))}
                    </Campo>
                  </div>

                  {dados.atividade.recentes.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma ação registrada.</p>
                  ) : (
                    <div className="space-y-1">
                      {dados.atividade.recentes.map((ac, i) => (
                        <div
                          key={`${ac.quando}-${i}`}
                          className="flex items-start justify-between gap-2 text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {ac.por}
                            </span>{' '}
                            <span className="text-slate-500 dark:text-slate-400">{ac.acao}</span>
                            {ac.alvo && (
                              <span className="block text-slate-400 truncate">{ac.alvo}</span>
                            )}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {safeDateTimeFormat(ac.quando)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    São as <strong>ações</strong> dentro da agência. Que tela cada pessoa abriu
                    e <strong>quanto tempo ficou não são medidos</strong> — não há registro de
                    navegação nem de início e fim de sessão.
                  </p>
                </Bloco>

                <Bloco titulo="Cobrança" icone={<CreditCard className="w-3.5 h-3.5" />}>
                  {dados.assinatura ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Campo rotulo="Status">{dados.assinatura.status}</Campo>
                      <Campo rotulo="Plano">{ou(dados.assinatura.plano)}</Campo>
                      <Campo rotulo="Preço">
                        {dados.assinatura.precoCentavos
                          ? formatCurrency(dados.assinatura.precoCentavos / 100)
                          : '—'}
                      </Campo>
                      <Campo rotulo="Pago até">
                        {ou(
                          dados.assinatura.periodoFim &&
                            safeDateTimeFormat(dados.assinatura.periodoFim)
                        )}
                      </Campo>
                      <Campo rotulo="Cancela no fim">
                        {dados.assinatura.cancelarNoFim ? 'sim' : 'não'}
                      </Campo>
                      <Campo rotulo="Assinou em">
                        {ou(
                          dados.assinatura.criadoEm &&
                            safeDateTimeFormat(dados.assinatura.criadoEm)
                        )}
                      </Campo>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Sem linha em `subscriptions` — esta agência nunca passou pelo checkout.
                    </p>
                  )}
                </Bloco>
              </>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};

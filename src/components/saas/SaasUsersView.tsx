import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, AlertCircle, Loader2, Search, Building2, Crown, ShieldCheck, MailCheck, MailX,
} from 'lucide-react';
import { listarUsuariosDoSaas, type UsuarioDoSaas } from '../../lib/authSupabase';
import { safeDateFormat } from '../../lib/utils';

/**
 * Usuários do produto inteiro, não de uma agência.
 *
 * Existe porque a pergunta "em quais agências fulano está?" não tinha onde
 * ser respondida: a tela de Usuários das Configurações mostra a equipe da
 * agência aberta, e um vínculo criado na agência errada ficava invisível
 * exatamente para quem precisava enxergá-lo.
 *
 * Só lê. Promover, rebaixar e remover continuam sendo operação dentro da
 * agência — fazer isso daqui contornaria as regras que o banco aplica lá
 * (dono não é rebaixado por admin, agência não fica sem dono ativo).
 */

const PAPEIS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  social_media: 'Social Media',
  designer: 'Designer',
  copywriter: 'Copywriter',
  financial: 'Financeiro',
};

export const SaasUsersView: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioDoSaas[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    listarUsuariosDoSaas()
      .then(setUsuarios)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar os usuários.'))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.email.toLowerCase().includes(alvo) ||
        (u.nome || '').toLowerCase().includes(alvo) ||
        u.agencias.some((a) => a.nome.toLowerCase().includes(alvo))
    );
  }, [usuarios, busca]);

  const semAgencia = usuarios.filter((u) => u.agencias.length === 0).length;

  if (carregando) {
    return (
      <div className="flex-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando os usuários...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          Super Admin
        </p>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Usuários</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Todas as contas do produto e as agências às quais cada uma tem acesso.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {!erro && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Users className="w-3.5 h-3.5" />
                Contas
              </div>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {usuarios.length}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                Com mais de uma agência
              </div>
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {usuarios.filter((u) => u.agencias.length > 1).length}
              </span>
            </div>

            {/* Conta sem vínculo é sintoma: cadastro que não completou, ou
                convite que nasceu na agência errada. */}
            <div className={`rounded-2xl border p-5 shadow-xs ${
              semAgencia > 0
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
              <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${
                semAgencia > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
              }`}>
                <AlertCircle className="w-3.5 h-3.5" />
                Sem nenhuma agência
              </div>
              <span className={`text-2xl font-black font-mono mt-1 block ${
                semAgencia > 0 ? 'text-amber-900 dark:text-amber-300' : 'text-slate-900 dark:text-white'
              }`}>
                {semAgencia}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por e-mail, nome ou agência..."
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filtrados.map((u) => (
              <div key={u.userId} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 lg:w-80 shrink-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {(u.nome || u.email || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {u.nome || 'Sem nome'}
                      {u.adminDaPlataforma && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                          title="Administrador da plataforma"
                        >
                          <Crown className="w-2.5 h-2.5" />
                          SaaS
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      {u.email}
                    </p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {u.agencias.length === 0 ? (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2 py-1 rounded-lg inline-block">
                      Nenhuma agência
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {u.agencias.map((a) => (
                        <span
                          key={a.workspaceId}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                            a.ativo
                              ? 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                              : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 line-through'
                          }`}
                          title={a.ativo ? undefined : 'Acesso suspenso nesta agência'}
                        >
                          <Building2 className="w-3 h-3 shrink-0" />
                          {a.nome}
                          <span className="font-medium text-slate-400 dark:text-slate-500">
                            {PAPEIS[a.papel] || a.papel}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-400">
                  <span
                    className="inline-flex items-center gap-1"
                    title={u.emailConfirmado ? 'E-mail confirmado' : 'E-mail não confirmado'}
                  >
                    {u.emailConfirmado ? (
                      <MailCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <MailX className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                  <span className="font-mono whitespace-nowrap">
                    {u.ultimoAcesso ? `Acesso ${safeDateFormat(u.ultimoAcesso)}` : 'Nunca entrou'}
                  </span>
                </div>
              </div>
            ))}

            {filtrados.length === 0 && (
              <div className="p-10 text-center text-xs text-slate-400">
                Nenhum usuário encontrado para "{busca}".
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Somente leitura. Papel e acesso são alterados dentro de cada agência, em
            Configurações → Usuários.
          </p>
        </>
      )}
    </div>
  );
};

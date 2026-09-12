import React, { useState } from 'react';
import { Lock, ExternalLink, LogOut, AlertTriangle } from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { abrirCobranca, type AcessoDaAgencia } from '../../lib/assinatura';
import { pode } from '../../lib/permissions';
import { safeDateFormat } from '../../lib/utils';
import { Button } from '../ui/button';

/**
 * O teste acabou, ou a assinatura não está em dia.
 *
 * Esta tela existe porque a alternativa era pior que não ter cobrança:
 * `workspaces.trial_ends_at` ficou no schema desde o começo **sem ninguém
 * escrever nem ler** — nenhuma agência tinha data, e nada bloqueava. Quem
 * lesse o schema concluiria que havia limite de teste. Uma coluna que parece
 * uma regra e não é engana mais que a ausência dela.
 *
 * Três decisões sobre o bloqueio, todas na mesma direção:
 *
 * 1. **Só bloqueia com resposta do banco.** `acessoDaAgencia` em `null`
 *    (consulta pendente ou falhou) passa direto. Derrubar quem está
 *    trabalhando porque a rede oscilou é pior que deixar passar quem não
 *    pagou.
 * 2. **A saída fica à mão.** Quem pode assinar vê o botão; quem não pode vê
 *    de quem cobrar. E sair da conta está sempre disponível — bloqueio sem
 *    porta é armadilha, não cobrança.
 * 3. **O admin da plataforma não é bloqueado**, senão o dono do produto
 *    perderia o `/admin` junto com a agência de teste dele.
 */

const TITULOS: Record<string, { titulo: string; explicacao: string }> = {
  teste_vencido: {
    titulo: 'Seu teste grátis terminou',
    explicacao:
      'O conteúdo continua todo aqui, guardado. Assinando, você volta exatamente de onde parou.',
  },
  vencida: {
    titulo: 'A renovação não foi confirmada',
    explicacao:
      'O Stripe não registrou o pagamento deste período. Conferir a forma de pagamento costuma resolver em um minuto.',
  },
  cancelada: {
    titulo: 'Assinatura cancelada',
    explicacao:
      'Nada foi apagado: os clientes, os conteúdos e os arquivos continuam no lugar. Assine de novo para voltar a usar.',
  },
  inadimplente: {
    titulo: 'Não conseguimos cobrar o cartão',
    explicacao:
      'O Stripe tentou algumas vezes e o pagamento foi recusado. Atualize a forma de pagamento para liberar o acesso.',
  },
};

interface AcessoBloqueadoProps {
  acesso: AcessoDaAgencia;
}

export const AcessoBloqueado: React.FC<AcessoBloqueadoProps> = ({ acesso }) => {
  const { currentUser, currentWorkspace, logout } = usePostfy();
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeAssinar = pode(currentUser?.role, 'gerenciar_workspace');
  const texto = TITULOS[acesso.motivo] ?? TITULOS.teste_vencido;

  const irParaOStripe = async () => {
    setIndo(true);
    setErro(null);
    try {
      window.location.href = await abrirCobranca(
        acesso.temAssinatura ? 'portal' : 'checkout',
        currentWorkspace.id
      );
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível abrir a página de pagamento.'
      );
      setIndo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900">
          <Lock className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {texto.titulo}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {texto.explicacao}
          </p>
          {acesso.testeTerminaEm && acesso.motivo === 'teste_vencido' && (
            <p className="text-xs text-slate-400">
              O teste de <strong>{currentWorkspace.name}</strong> terminou em{' '}
              {safeDateFormat(acesso.testeTerminaEm)}.
            </p>
          )}
        </div>

        {erro && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            {erro}
          </div>
        )}

        {podeAssinar ? (
          <Button
            onClick={() => void irParaOStripe()}
            disabled={indo}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4" />
            {indo
              ? 'Abrindo...'
              : acesso.temAssinatura
                ? 'Atualizar forma de pagamento'
                : 'Assinar o Orquesia'}
          </Button>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Quem assina é o proprietário ou um administrador de{' '}
            <strong>{currentWorkspace.name}</strong>. Avise a pessoa responsável para
            liberar o acesso da equipe.
          </div>
        )}

        {/* Bloqueio sem porta de saída é armadilha. */}
        <Button variant="ghost"
          onClick={() => void logout()}
          className="w-full dark:hover:text-white"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
};

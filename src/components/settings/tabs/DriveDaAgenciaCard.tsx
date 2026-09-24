import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Link2, Loader2, Trash2, CheckCircle2, Loader, Plus } from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';
import { Button } from '../../ui/button';
import { useConfirmacao } from '../../ui/alert-dialog';
import { googleConfigurado, faltaDoGoogle } from '../../../lib/google';
import {
  contasDoDrive,
  conectarDrive,
  desconectarDrive,
  type ContaDoDrive,
} from '../../../lib/driveDaAgencia';
import { safeDateFormat } from '../../../lib/utils';
import { ApiError } from '../../../lib/api';

/**
 * As contas do Google Drive da agência.
 *
 * A primeira versão pedia autorização **a cada peça**, dentro da modal de
 * conteúdo: quem monta dez posts numa tarde autorizava dez vezes. E era uma
 * conta só — uma agência costuma ter o Drive dela e o do cliente, e trocar
 * exigia desconectar e reconectar.
 *
 * A tela diz **de quem é cada conta**. Sem isso, "conectado" não ajuda a
 * escolher, e quem conectar a conta errada do Google só descobre quando não
 * achar os arquivos.
 */
export const DriveDaAgenciaCard: React.FC = () => {
  const { currentWorkspace } = usePostfy();
  const { pedir, dialogo } = useConfirmacao();

  const [contas, setContas] = useState<ContaDoDrive[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setCarregando(true);
    setContas(await contasDoDrive(currentWorkspace.id));
    setCarregando(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
    A janela da autorização avisa esta aba quando termina — é a mesma
    mensagem que o retorno do Instagram manda. Sem isso, a pessoa autoriza,
    fecha a janela e a tela continua dizendo que não há conexão.
  */
  useEffect(() => {
    const aoVoltar = (evento: MessageEvent) => {
      if (evento.data?.origem === 'orquesia-social') void carregar();
    };
    window.addEventListener('message', aoVoltar);
    return () => window.removeEventListener('message', aoVoltar);
  }, [carregar]);

  const conectar = async () => {
    if (!currentWorkspace?.id) return;
    setErro(null);
    setOcupado(true);
    try {
      await conectarDrive(currentWorkspace.id);
    } catch (e) {
      setErro(
        e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível conectar.'
      );
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = (conta: ContaDoDrive) => {
    pedir({
      titulo: `Desconectar ${conta.email || 'esta conta'}?`,
      descricao:
        'As peças que usam arquivos desta conta deixam de ter prévia e de poder ser ' +
        'agendadas até alguém conectá-la de novo. Nada é apagado do seu Drive.',
      rotuloConfirmar: 'Desconectar',
      aoConfirmar: async () => {
        setOcupado(true);
        try {
          await desconectarDrive(conta.id);
          setContas((atuais) => atuais.filter((c) => c.id !== conta.id));
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não foi possível desconectar.');
        } finally {
          setOcupado(false);
        }
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
      {dialogo}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Google Drive</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl leading-relaxed">
              A arte vem das suas pastas, e o acervo continua lá. Conecte quantas contas
              precisar — a sua e a do cliente, por exemplo: ao adicionar mídia, você
              escolhe de qual buscar.
            </p>

            {!googleConfigurado() && (
              /* O que falta, com o nome da variável — a mesma regra do resto
                 desta tela. "Em breve" aqui seria mentira: o código existe. */
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                Falta configurar {faltaDoGoogle().join(' e ')} no servidor.
              </p>
            )}

            {erro && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2">{erro}</p>}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            type="button"
            variant={contas.length ? 'outline' : 'primary'}
            onClick={() => void conectar()}
            disabled={ocupado || carregando || !googleConfigurado()}
          >
            {ocupado ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : contas.length ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            {ocupado ? 'Autorizando...' : contas.length ? 'Conectar outra' : 'Conectar'}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {carregando ? (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Loader className="w-3 h-3 animate-spin" />
            consultando...
          </p>
        ) : contas.length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nenhuma conta conectada. Sem isso, o Google Drive fica desligado no menu de
            mídia dos conteúdos.
          </p>
        ) : (
          contas.map((conta) => (
            <div
              key={conta.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {conta.email || 'conta do Google'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  desde {safeDateFormat(conta.conectadaEm)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectada
                </span>

                <Button
                  variant="destructive"
                  size="icon-sm"
                  type="button"
                  onClick={() => desconectar(conta)}
                  disabled={ocupado}
                  aria-label={`Desconectar ${conta.email || 'conta'}`}
                  title="Desconectar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

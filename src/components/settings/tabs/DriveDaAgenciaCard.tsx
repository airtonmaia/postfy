import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Link2, Loader2, Trash2, CheckCircle2, Loader } from 'lucide-react';
import { usePostfy } from '../../../context/PostfyContext';
import { Button } from '../../ui/button';
import { useConfirmacao } from '../../ui/alert-dialog';
import { googleConfigurado, faltaDoGoogle } from '../../../lib/google';
import {
  driveDaAgencia,
  conectarDrive,
  desconectarDrive,
  type DriveConectado,
} from '../../../lib/driveDaAgencia';
import { safeDateFormat } from '../../../lib/utils';
import { ApiError } from '../../../lib/api';

/**
 * O Google Drive da agência, conectado uma vez.
 *
 * A primeira versão pedia autorização **a cada peça**, dentro da modal de
 * conteúdo: quem monta dez posts numa tarde autorizava dez vezes, com a
 * janela do Google abrindo no meio do trabalho. Aqui a conexão é da agência,
 * como a conta de Instagram — e pela mesma razão: ela é da agência, não de
 * quem por acaso está com a modal aberta.
 *
 * A tela diz **de quem é a conta**. Sem isso, "conectado" não diz nada útil,
 * e quem conectar a conta errada do Google só descobre quando não achar os
 * arquivos no seletor.
 */
export const DriveDaAgenciaCard: React.FC = () => {
  const { currentWorkspace } = usePostfy();
  const { pedir, dialogo } = useConfirmacao();

  const [conexao, setConexao] = useState<DriveConectado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setCarregando(true);
    setConexao(await driveDaAgencia(currentWorkspace.id));
    setCarregando(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
    A janela da autorização avisa esta aba quando termina — é a mesma mensagem
    que o retorno do Instagram manda. Sem isso, a pessoa autoriza, fecha a
    janela e a tela continua dizendo que não há conexão.
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
      setErro(e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível conectar.');
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = () => {
    if (!currentWorkspace?.id) return;

    pedir({
      titulo: 'Desconectar o Google Drive?',
      descricao:
        'As peças que apontam para arquivos do Drive deixam de poder ser agendadas até ' +
        'alguém conectar de novo — é na hora de agendar que o arquivo é trazido. ' +
        'Nada é apagado do seu Drive.',
      rotuloConfirmar: 'Desconectar',
      aoConfirmar: async () => {
        setOcupado(true);
        try {
          await desconectarDrive(currentWorkspace.id);
          setConexao(null);
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
              A arte vem da sua pasta, e o acervo continua lá: o Orquesia copia o
              arquivo só na hora de agendar e apaga a cópia depois que a peça vai ao
              ar. Conectado uma vez, vale para toda a equipe desta agência.
            </p>

            {carregando ? (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Loader className="w-3 h-3 animate-spin" />
                consultando...
              </p>
            ) : conexao ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
                {conexao.email || 'conta do Google conectada'}
                {' · '}
                desde {safeDateFormat(conexao.conectadoEm)}
              </p>
            ) : !googleConfigurado() ? (
              /* O que falta, com o nome da variável — a mesma regra do resto
                 desta tela. "Em breve" aqui seria mentira: o código existe. */
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                Falta configurar {faltaDoGoogle().join(' e ')} no servidor.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Nenhuma conta conectada. Sem isso, o Google Drive fica desligado no
                menu de mídia dos conteúdos.
              </p>
            )}

            {erro && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2">{erro}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {conexao && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              Conectado
            </span>
          )}

          {conexao ? (
            <Button
              variant="destructive"
              size="icon-sm"
              type="button"
              onClick={desconectar}
              disabled={ocupado}
              aria-label="Desconectar o Google Drive"
              title="Desconectar"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void conectar()}
              disabled={ocupado || carregando || !googleConfigurado()}
            >
              {ocupado ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
              {ocupado ? 'Autorizando...' : 'Conectar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

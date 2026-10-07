import React from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Interruptor } from '../ui/interruptor';
import {
  BLOCOS_DO_PAINEL,
  alternarBloco,
  blocoVisivel,
  blocosDaLargura,
  type IdDoBloco,
} from '../../lib/blocosDoPainel';

/**
 * Escolher o que o painel mostra.
 *
 * **A escolha é da pessoa, não da agência**: duas pessoas da mesma equipe
 * olham o painel por motivos diferentes — quem produz quer as publicações de
 * hoje, quem administra quer a saúde e os clientes. Ela fica em
 * `user_settings`, no banco, porque no `localStorage` ficaria presa a um
 * navegador (armadilha 4) e a mesma pessoa abriria o celular com tudo de
 * volta.
 *
 * **A lista é a da largura atual, e isso não é recorte de preferência — é
 * desenho.** A saúde e os insights não existem no celular, e os atalhos não
 * existem no computador. Um interruptor para o que a tela não tem seria
 * oferecer o que não acontece.
 *
 * **Grava a cada toque, sem botão de salvar.** É preferência de aparência: o
 * resultado está atrás do diálogo e aparece quando ele fecha; um "salvar"
 * criaria um estado em que a tela já mudou e o banco ainda não — e quem
 * fechasse sem clicar perderia a escolha sem aviso.
 */

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  estreita: boolean;
  ocultos: string[];
  aoMudar: (ocultos: string[]) => void;
}

export const PersonalizarPainel: React.FC<Props> = ({
  aberto,
  aoFechar,
  estreita,
  ocultos,
  aoMudar,
}) => {
  const blocos = blocosDaLargura(estreita);
  const foraDestaLargura = BLOCOS_DO_PAINEL.length - blocos.length;
  const escondidosAqui = blocos.filter((b) => !blocoVisivel(b.id, ocultos)).length;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="recado" className="p-0 gap-0">
        <div className="shrink-0 p-5 pr-12 border-b border-slate-200 dark:border-slate-800">
          <DialogTitle asChild>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Personalizar o painel
            </h3>
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            A escolha é sua e segue com você — ela não muda o painel de quem divide a agência.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-2">
          {blocos.map((bloco) => {
            const visivel = blocoVisivel(bloco.id, ocultos);
            return (
              <div
                key={bloco.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    visivel
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {visivel ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {bloco.rotulo}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {bloco.descricao}
                  </p>
                </div>

                <Interruptor
                  ligado={visivel}
                  rotulo={`${visivel ? 'Esconder' : 'Mostrar'} ${bloco.rotulo}`}
                  aoMudar={(ligado) =>
                    aoMudar(alternarBloco(bloco.id as IdDoBloco, ocultos, ligado))
                  }
                />
              </div>
            );
          })}

          {/*
            A frase só aparece quando há blocos fora desta largura — dizer "no
            computador há mais" numa tela que já mostra tudo seria ruído.
          */}
          {foraDestaLargura > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
              {estreita
                ? 'A saúde operacional e os insights não entram no celular: juntos eles ocupam duas telas antes do primeiro número. No computador eles aparecem, e podem ser desligados por lá.'
                : 'Os atalhos do menu existem só no celular, onde a barra lateral é uma gaveta.'}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center gap-2">
          {/*
            Repor o padrão limpa a lista inteira, inclusive o que foi escondido
            na outra largura: é a saída de quem desligou alguma coisa e não
            lembra o quê.
          */}
          <Button
            variant="ghost"
            onClick={() => aoMudar([])}
            disabled={ocultos.length === 0}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Mostrar tudo
          </Button>
          <span className="flex-1 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            {escondidosAqui > 0 ? `${escondidosAqui} escondido(s)` : 'Tudo à vista'}
          </span>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

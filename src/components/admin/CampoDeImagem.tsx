import React, { useRef, useState } from 'react';
import { Upload, X, ImageOff, Link2 } from 'lucide-react';
import { arquivosApi, PASTA_DA_PLATAFORMA } from '../../lib/api';
import { Button } from '../ui/button';

/**
 * Endereço de imagem: enviando o arquivo ou colando a URL.
 *
 * Os dois caminhos existem porque o envio depende do R2 estar configurado, e
 * ele pode não estar. Quando não estiver, a mensagem diz qual variável falta
 * — em vez de a barra travar em 0% sem explicação, que foi o que aconteceu na
 * primeira falha de upload em produção.
 *
 * Nada de `readAsDataURL`: base64 dentro do registro foi o problema que o R2
 * veio resolver — um logo de 4,8 MB estourou a cota do navegador.
 */

interface Props {
  rotulo: string;
  ajuda?: string;
  valor: string;
  aoMudar: (valor: string) => void;
  /** Proporção da prévia. `banner` mostra deitado, `marca` mostra quadrado. */
  formato?: 'banner' | 'marca';
}

export const CampoDeImagem: React.FC<Props> = ({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  formato = 'banner',
}) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (arquivo: File) => {
    setErro(null);
    setEnviando(true);
    setProgresso(0);
    try {
      const url = await arquivosApi.enviar(arquivo, PASTA_DA_PLATAFORMA, setProgresso);
      aoMudar(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Altura mínima para os campos lado a lado alinharem: uma ajuda que
          quebra em duas linhas empurrava só a coluna dela para baixo. */}
      <div className="min-h-[3.25rem]">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{rotulo}</label>
        {ajuda && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {ajuda}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <div
          className={`shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center ${
            formato === 'marca' ? 'w-16 h-16' : 'w-28 h-16'
          }`}
        >
          {valor ? (
            <img src={valor} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageOff className="w-5 h-5 text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={valor}
              onChange={(e) => aoMudar(e.target.value)}
              placeholder="https://... ou /arquivo.jpg"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
            {valor && (
              <Button variant="destructive" size="icon-sm"
                type="button"
                onClick={() => aoMudar('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                title="Limpar"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void enviar(arquivo);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" size="sm"
              type="button"
              disabled={enviando}
              onClick={() => entrada.current?.click()}
              className="disabled:cursor-wait"
            >
              <Upload className="w-3.5 h-3.5" />
              {enviando ? `Enviando ${progresso}%` : 'Enviar arquivo'}
            </Button>
          </div>

          {erro && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-relaxed">{erro}</p>
          )}
        </div>
      </div>
    </div>
  );
};

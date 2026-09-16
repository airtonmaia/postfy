import React, { useRef, useState } from 'react';
import { arquivosApi, ApiError } from '../../lib/api';
import { usePostfy } from '../../context/PostfyContext';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  Plus, 
  MoveLeft, 
  MoveRight,
  ExternalLink,
  Link2,
  UploadCloud,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';

interface MediaUploaderProps {
  mediaUrls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  label?: string;
  helperText?: string;
  /**
   * Outras origens da arte, no menu do botão "Adicionar mídia".
   *
   * Vem de fora porque quais integrações existem é decisão da tela que usa o
   * uploader — não do uploader.
   */
  origens?: OrigemDeMidia[];
}

export interface OrigemDeMidia {
  rotulo: string;
  /** Falso enquanto a integração não existe: entra no menu desligada. */
  disponivel: boolean;
  aoEscolher?: () => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  mediaUrls,
  onChange,
  maxFiles = 10,
  label = 'Mídias e Criativos (Fotos e Vídeos)',
  helperText = 'Adicione as imagens ou vídeos do seu conteúdo. Para carrossel, você pode reordenar as páginas.',
  origens = []
}) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const { currentWorkspace } = usePostfy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  /**
   * Limite por arquivo, alinhado ao que a função de upload aceita.
   * O arquivo vai do navegador direto para o Cloudflare R2 por URL
   * pré-assinada — antes virava base64 no localStorage e dois ou três anexos
   * estouravam a cota do navegador.
   */
  const TAMANHO_MAXIMO_BYTES = 100 * 1024 * 1024;

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const vagas = maxFiles - mediaUrls.length;
    if (vagas <= 0) {
      setUploadError(`Limite de ${maxFiles} arquivos atingido.`);
      return;
    }

    const selecionados = Array.from(files).slice(0, vagas);
    const grandes = selecionados.filter((f) => f.size > TAMANHO_MAXIMO_BYTES);
    const aceitos = selecionados.filter((f) => f.size <= TAMANHO_MAXIMO_BYTES);

    if (grandes.length > 0) {
      setUploadError(
        `${grandes.length === 1 ? 'O arquivo passa' : 'Alguns arquivos passam'} de ` +
        `${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB e não ` +
        `${grandes.length === 1 ? 'foi anexado' : 'foram anexados'}.`
      );
    }
    if (aceitos.length === 0) return;

    setEnviando(true);
    setProgresso(0);

    const enviados: string[] = [];
    try {
      for (let i = 0; i < aceitos.length; i++) {
        const url = await arquivosApi.enviar(
          aceitos[i],
          currentWorkspace?.id || '',
          (pct) => setProgresso(Math.round(((i + pct / 100) / aceitos.length) * 100))
        );
        enviados.push(url);
      }
      // Um único onChange no fim: chamar dentro do laço descartaria os
      // anteriores, porque cada chamada parte do mesmo mediaUrls capturado.
      if (enviados.length) onChange([...mediaUrls, ...enviados]);
    } catch (err) {
      const mensagem =
        err instanceof ApiError && err.naoConfigurado
          ? 'Armazenamento de arquivos ainda não configurado. Por enquanto, cole a URL da mídia abaixo.'
          : err instanceof Error
          ? err.message
          : 'Falha ao enviar o arquivo.';
      setUploadError(mensagem);
      if (enviados.length) onChange([...mediaUrls, ...enviados]);
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveMedia = (index: number) => {
    const updated = mediaUrls.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMoveLeft = (index: number) => {
    if (index === 0) return;
    const updated = [...mediaUrls];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onChange(updated);
  };

  const handleMoveRight = (index: number) => {
    if (index === mediaUrls.length - 1) return;
    const updated = [...mediaUrls];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onChange(updated);
  };

  const handleAddCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    onChange([...mediaUrls, customUrlInput.trim()]);
    setCustomUrlInput('');
    setShowUrlInput(false);
  };

  const isVideo = (url: string) => {
    return url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') || url.startsWith('data:video');
  };

  const cheio = mediaUrls.length >= maxFiles;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            {label}
          </label>
          <span className="text-[11px] text-slate-400">{helperText}</span>
        </div>

        {/*
          Botão dividido: a ação comum fica no clique direto, e as outras
          origens ficam na seta. Antes eram quatro botões soltos disputando a
          mesma linha — e a que quase todo mundo usa, o upload do computador,
          não tinha destaque nenhum.

          **Ele é primário, e a caixa em volta saiu.** Na versão anterior os
          dois lados eram `soft` — roxo pálido com borda — dentro de um `div`
          com mais uma borda roxa. Três linhas para uma ação só: o par lia como
          campo de formulário, não como botão, e a ação mais usada desta seção
          ficava com menos peso que o "Adicionar" ao lado do campo de URL, que
          é primário.

          O que mostra que são dois controles agora é a **emenda**, não uma
          moldura: canto reto do lado colado (a mesma composição de campo
          grudado no vizinho) e uma linha translúcida na cor do texto sobre o
          primário — que acompanha a marca da agência em vez de fixar branco.
        */}
        <div className="relative shrink-0">
          <div className="flex items-stretch">
            <Button
              type="button"
              disabled={cheio}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-none rounded-l-lg"
            >
              <UploadCloud className="w-4 h-4" />
              Adicionar mídia
            </Button>
            {/*
              A seta desliga junto com o botão: as duas origens do menu também
              acrescentam mídia, e a do link nem passava pelo limite — com a
              fileira cheia ela ainda adicionava, porque `handleAddCustomUrl`
              não confere `maxFiles`.
            */}
            <Button size="icon-sm"
              type="button"
              disabled={cheio}
              onClick={() => setMenuAberto((a) => !a)}
              aria-label="Outras origens"
              className="rounded-none rounded-r-lg border-l border-primary-foreground/25"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {menuAberto && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-56 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5">
                <Button variant="ghost"
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full justify-start text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                >
                  <UploadCloud className="w-4 h-4 text-slate-400" />
                  Do computador
                </Button>

                <Button variant="ghost"
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    setShowUrlInput(true);
                  }}
                  className="w-full justify-start text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                >
                  <Link2 className="w-4 h-4 text-slate-400" />
                  Por link da web
                </Button>

                {origens.length > 0 && (
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                )}

                {/* Integração que ainda não existe entra desligada, dizendo
                    "em breve". Clicável e muda seria a promessa que a
                    armadilha 9 proíbe. */}
                {origens.map((origem) => (
                  <Button variant="ghost"
                    key={origem.rotulo}
                    type="button"
                    disabled={!origem.disponivel}
                    onClick={() => {
                      setMenuAberto(false);
                      origem.aoEscolher?.();
                    }}
                    className="w-full text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-transparent"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                    <span className="flex-1 text-left">{origem.rotulo}</span>
                    {!origem.disponivel && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        em breve
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl animate-in fade-in">
          <input
            type="url"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="Cole o link da imagem (ex: https://images.unsplash.com/...)"
            className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-purple-500"
          />
          <Button
            type="button"
            onClick={handleAddCustomUrl}
          >
            Adicionar
          </Button>
        </div>
      )}

      {enviando && (
        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-300">
            <span>Enviando arquivo...</span>
            <span>{progresso}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-purple-100 dark:bg-purple-900 overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-200"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[11px] font-medium">
          {uploadError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/*
        Fileira única, na ordem em que as páginas vão sair. O carrossel é uma
        sequência, e a grade de duas colunas fazia a página 3 aparecer embaixo
        da 1 — a ordem que importa some.
      */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-stretch gap-3 overflow-x-auto pb-1 rounded-2xl transition ${
          isDragging ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-slate-900' : ''
        }`}
      >
        {mediaUrls.map((url, idx) => (
          <div
            key={idx}
            className="group relative w-32 shrink-0 aspect-[4/5] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-xs"
          >
            {isVideo(url) ? (
              <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <img src={url} alt={`Mídia ${idx + 1}`} className="w-full h-full object-cover" />
            )}

            {/* O número é a página no carrossel, não um enfeite. */}
            <div className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-lg bg-black/70 text-white text-[11px] font-bold backdrop-blur-xs flex items-center justify-center">
              {idx + 1}
            </div>

            {isVideo(url) && (
              <div className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/70 text-white">
                <Video className="w-2.5 h-2.5" />
              </div>
            )}

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
              <div className="flex justify-end">
                <Button variant="destructive" size="icon-sm"
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="bg-rose-600 text-white"
                  title="Excluir arquivo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex items-center justify-between text-white">
                <Button size="icon-sm"
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveLeft(idx)}
                  className="bg-black/60 hover:bg-black/80"
                  title="Mover para a esquerda"
                >
                  <MoveLeft className="w-3 h-3" />
                </Button>
                <Button size="icon-sm"
                  type="button"
                  disabled={idx === mediaUrls.length - 1}
                  onClick={() => handleMoveRight(idx)}
                  className="bg-black/60 hover:bg-black/80"
                  title="Mover para a direita"
                >
                  <MoveRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {/*
          **Área de soltar arquivo, e por isso `<button>` à mão.**

          Ela era um `<Button>`, e o resultado em tela era uma faixa achatada
          com o rótulo saindo por baixo. O motivo é a escala: o tamanho do
          botão fixa a altura (`h-8`, 32px), e com largura **e** altura
          definidas o `aspect-[4/5]` que estava no `className` não tem como
          agir — `aspect-ratio` só resolve o eixo que está em `auto`. Sobrava
          um ícone de 20px e um rótulo empilhados numa caixa de 32px.

          É o papel "card clicável" que o `tests/botoes.test.ts` já nomeia:
          conteúdo em bloco e altura própria não cabem na escala do botão. E
          nada local acusava — `tsc` compila, o vitest não monta componente e o
          `vite build` não mede caixa.

          Quadrada de 160px: é a altura que a fileira já tem (a miniatura é
          `w-32` em 4/5 = 128×160), então o fundo da fileira fecha reto, e o
          alvo de clique deixa de ser uma tarja. O aviso de arrastar mora aqui
          dentro agora, que é onde o arquivo é solto — antes ele só aparecia
          embaixo **depois** da primeira mídia, ou seja, nunca na hora em que
          adianta.
        */}
        {!cheio && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-40 h-40 shrink-0 px-3 flex flex-col items-center justify-center gap-1.5
              rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700
              bg-slate-50 dark:bg-slate-950/60 text-slate-400 transition cursor-pointer
              hover:border-purple-400 hover:text-purple-600"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-bold">Adicionar</span>
            <span className="text-[10px] font-medium">ou arraste aqui</span>
          </button>
        )}
      </div>

      {mediaUrls.length > 0 && (
        <span className="block text-[11px] text-slate-400">
          {mediaUrls.length} de {maxFiles}
        </span>
      )}
    </div>
  );
};

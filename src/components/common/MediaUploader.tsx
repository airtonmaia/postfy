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
  Sparkles
} from 'lucide-react';

interface MediaUploaderProps {
  mediaUrls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  label?: string;
  helperText?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  mediaUrls,
  onChange,
  maxFiles = 10,
  label = 'Mídias e Criativos (Fotos e Vídeos)',
  helperText = 'Arraste imagens/vídeos ou clique para selecionar do seu computador (Suporta até 10 arquivos para carrossel)'
}) => {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          <span className="text-[11px] text-slate-400">
            {mediaUrls.length} de {maxFiles} arquivos adicionados
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" />
          {showUrlInput ? 'Ocultar link web' : 'Inserir por URL web'}
        </button>
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
          <button
            type="button"
            onClick={handleAddCustomUrl}
            className="px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 cursor-pointer"
          >
            Adicionar
          </button>
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

      {/* Drag and Drop Zone */}
      {mediaUrls.length < maxFiles && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
            isDragging 
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' 
              : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 bg-slate-50 dark:bg-slate-950/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Clique para fazer upload ou arraste suas fotos e vídeos aqui
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
          </div>
        </div>
      )}

      {/* Uploaded Media Grid & Carousel Preview */}
      {mediaUrls.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {mediaUrls.map((url, idx) => (
              <div 
                key={idx} 
                className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-xs"
              >
                {isVideo(url) ? (
                  <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                ) : (
                  <img src={url} alt={`Mídia ${idx + 1}`} className="w-full h-full object-cover" />
                )}

                {/* Badge Index */}
                <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                  {isVideo(url) ? <Video className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
                  #{idx + 1}
                </div>

                {/* Hover Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMedia(idx);
                      }}
                      className="p-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 transition"
                      title="Excluir arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-white">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveLeft(idx);
                      }}
                      className="p-1 rounded bg-black/60 hover:bg-black/80 disabled:opacity-30"
                      title="Mover para esquerda"
                    >
                      <MoveLeft className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-bold">Posição {idx + 1}</span>
                    <button
                      type="button"
                      disabled={idx === mediaUrls.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveRight(idx);
                      }}
                      className="p-1 rounded bg-black/60 hover:bg-black/80 disabled:opacity-30"
                      title="Mover para direita"
                    >
                      <MoveRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

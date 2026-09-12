import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  Image as ImageIcon, 
  FileCode, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Link as LinkIcon,
  CloudUpload,
  Eye
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { arquivosApi, ApiError } from '../../lib/api';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from './button';

export interface UploadedFileInfo {
  name: string;
  size: string;
  type: string;
  url: string;
  rawFile?: File;
}

interface FileUploadProps {
  onFileSelect: (fileInfo: UploadedFileInfo) => void;
  onFileRemove?: () => void;
  accept?: string;
  maxSizeMB?: number;
  value?: string;
  fileName?: string;
  fileSize?: string;
  label?: string;
  helperText?: string;
  allowUrlFallback?: boolean;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
  imageOnly?: boolean;
}

const DEFAULT_IMAGE_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp,image/avif,image/gif,image/x-icon,image/*,.svg,.png,.jpg,.jpeg,.webp,.avif,.gif,.ico";
const DEFAULT_ALL_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp,image/avif,image/gif,image/x-icon,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.svg,.png,.jpg,.jpeg,.webp,.avif,.gif,.ico";

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileRemove,
  accept,
  maxSizeMB = 25,
  value,
  fileName,
  fileSize,
  label,
  helperText,
  allowUrlFallback = true,
  className,
  disabled = false,
  compact = false,
  imageOnly = false
}) => {
  const effectiveAccept = accept || (imageOnly ? DEFAULT_IMAGE_ACCEPT : DEFAULT_ALL_ACCEPT);
  const effectiveHelperText = helperText || (
    imageOnly 
      ? `Suporta SVG, PNG, JPG, WEBP, AVIF, ICO (até ${maxSizeMB}MB)` 
      : `Suporta PNG, JPG, SVG, MP4, PDF, ZIP (até ${maxSizeMB}MB)`
  );

  const { currentWorkspace } = usePostfy();
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [currentFile, setCurrentFile] = useState<UploadedFileInfo | null>(
    value ? {
      name: fileName || (value.startsWith('data:') ? 'imagem-enviada' : value.split('/').pop() || 'arquivo'),
      size: fileSize || '',
      type: value.startsWith('data:image') || value.startsWith('data:image/svg+xml') || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)(\?.*)?$/i.test(value) ? 'image' : 'file',
      url: value
    } : null
  );

  useEffect(() => {
    if (value) {
      setCurrentFile({
        name: fileName || (value.startsWith('data:') ? 'imagem-enviada' : value.split('/').pop() || 'arquivo'),
        size: fileSize || '',
        type: value.startsWith('data:image') || value.startsWith('data:image/svg+xml') || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)(\?.*)?$/i.test(value) ? 'image' : 'file',
        url: value
      });
      setImgError(false);
    } else if (!value && currentFile) {
      setCurrentFile(null);
    }
  }, [value, fileName, fileSize]);

  const [isUrlMode, setIsUrlMode] = useState(false);
  const [inputUrl, setInputUrl] = useState(value && !value.startsWith('data:') ? value : '');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const processFile = (file: File) => {
    setError(null);
    setImgError(false);
    
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`O arquivo excede o limite máximo de ${maxSizeMB}MB.`);
      return;
    }

    // Check imageOnly restriction if set
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    const isImageFile = file.type.startsWith('image/') || isSvg || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)$/i.test(file.name);

    if (imageOnly && !isImageFile) {
      setError('Formato não suportado. Por favor, envie uma imagem (SVG, PNG, JPG, WEBP, AVIF ou ICO).');
      return;
    }

    // O arquivo vai para o R2 e o que fica guardado é a URL.
    //
    // Antes isto virava base64 dentro do próprio registro: um cliente com
    // logo ocupou 4,8 MB, estourou a cota do navegador e ainda foi parar
    // numa coluna de texto no Postgres. A string acompanhava o registro em
    // toda leitura, deixando lenta uma tela que só queria o nome do cliente.
    void enviarParaOArmazenamento(file, isSvg);
  };

  const enviarParaOArmazenamento = async (file: File, isSvg: boolean) => {
    if (!currentWorkspace?.id) {
      setError('Agência não identificada. Recarregue a página.');
      return;
    }

    setEnviando(true);
    setProgresso(0);
    try {
      const url = await arquivosApi.enviar(file, currentWorkspace.id, setProgresso);

      const fileInfo: UploadedFileInfo = {
        name: file.name,
        size: formatBytes(file.size),
        type: isSvg ? 'image/svg+xml' : file.type || 'image',
        url,
        rawFile: file
      };
      setCurrentFile(fileInfo);
      onFileSelect(fileInfo);
    } catch (err) {
      // Sem armazenamento configurado não caímos de volta no base64: era ele
      // o problema. A tela oferece colar a URL, que continua funcionando.
      setError(
        err instanceof ApiError && err.naoConfigurado
          ? 'Armazenamento de arquivos ainda não configurado. Cole a URL da imagem abaixo.'
          : err instanceof Error
          ? err.message
          : 'Falha ao enviar o arquivo.'
      );
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentFile(null);
    setInputUrl('');
    setError(null);
    setImgError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onFileRemove) {
      onFileRemove();
    }
  };

  const handleUrlSubmit = () => {
    if (!inputUrl.trim()) return;
    const url = inputUrl.trim();
    const isImg = url.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)(\?.*)?$/i.test(url);
    const isSvg = url.toLowerCase().includes('.svg') || url.startsWith('data:image/svg+xml');

    const fileInfo: UploadedFileInfo = {
      name: url.split('/').pop()?.split('?')[0] || 'link-externo',
      size: 'Nuvem',
      type: isSvg ? 'image/svg+xml' : isImg ? 'image' : 'link',
      url: url
    };
    setCurrentFile(fileInfo);
    onFileSelect(fileInfo);
    setIsUrlMode(false);
  };

  const isSvg = currentFile?.type?.includes('svg') || currentFile?.name?.toLowerCase().endsWith('.svg') || currentFile?.url?.includes('.svg');
  const isImage = currentFile?.type?.includes('image') || isSvg || currentFile?.url?.startsWith('data:image') || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)(\?.*)?$/i.test(currentFile?.name || '') || /\.(jpeg|jpg|gif|png|webp|svg|avif|ico)(\?.*)?$/i.test(currentFile?.url || '');
  const isPdf = currentFile?.type?.includes('pdf') || currentFile?.name?.endsWith('.pdf');

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {allowUrlFallback && !currentFile && (
            <Button variant="ghost"
              type="button"
              onClick={() => setIsUrlMode(!isUrlMode)}
              className="text-purple-600 dark:text-purple-400 hover:underline"
            >
              <LinkIcon className="w-3 h-3" />
              {isUrlMode ? 'Enviar do computador' : 'Inserir link externo'}
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={effectiveAccept}
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />

      {/* State 1: File Already Uploaded / Selected */}
      {currentFile ? (
        <div className="relative group p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3 transition hover:border-purple-300 dark:hover:border-purple-700">
          <div className="flex items-center gap-3 min-w-0">
            {isImage && !imgError ? (
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center p-1">
                <img 
                  src={currentFile.url} 
                  alt={currentFile.name} 
                  className="max-w-full max-h-full object-contain" 
                  onError={() => setImgError(true)}
                />
              </div>
            ) : isSvg ? (
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 border border-purple-200 dark:border-purple-900 flex items-center justify-center shrink-0">
                <FileCode className="w-6 h-6" />
              </div>
            ) : isPdf ? (
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-900 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 border border-purple-200 dark:border-purple-900 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                {currentFile.name}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {currentFile.size && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {currentFile.size}
                  </span>
                )}
                {/* `rounded-full` porque é assim que o projeto pinta um badge
                    deste tamanho — o `rounded-xl`/`rounded-2xl` do CLAUDE.md é
                    canto de peça, e badge de 10px não é peça. Estava em
                    `rounded-md`, um terceiro canto que só este lugar usava. */}
                {isSvg && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    SVG Vetorial
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Pronto
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentFile.url && (
              <a
                href={currentFile.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Visualizar arquivo"
              >
                <Eye className="w-4 h-4" />
              </a>
            )}
            <Button variant="destructive" size="icon-sm"
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              title="Remover arquivo"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : isUrlMode ? (
        /* State 2: URL Input Fallback */
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://... (SVG, PNG, JPG, WebP ou link na nuvem)"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
            />
          </div>
          <Button
            type="button"
            onClick={handleUrlSubmit}
          >
            Vincular
          </Button>
        </div>
      ) : enviando ? (
        /* Envio em andamento. Sem isto o clique parece não ter feito nada e a
           pessoa tenta de novo, disparando um segundo upload. */
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
          <CloudUpload className="w-5 h-5 text-purple-600 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Enviando... {progresso}%
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-purple-100 dark:bg-purple-900/40 overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all duration-200"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* State 3: Shadcn-Styled Drag & Drop Upload Zone */
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none",
            compact ? "p-4" : "p-6 sm:p-8",
            isDragging 
              ? "border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 scale-[1.01]" 
              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-purple-50/30 dark:hover:bg-purple-950/10 hover:border-purple-300 dark:hover:border-purple-700",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 bg-purple-100/70 dark:bg-purple-950/60 shadow-xs mb-3 transition-transform group-hover:scale-110",
            compact ? "w-10 h-10" : "w-12 h-12"
          )}>
            <CloudUpload className={compact ? "w-5 h-5" : "w-6 h-6"} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="text-purple-600 dark:text-purple-400 underline decoration-purple-400 decoration-1 underline-offset-2">
                Clique para enviar
              </span>{' '}
              ou arraste o arquivo até aqui
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {effectiveHelperText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

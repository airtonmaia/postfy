import React, { useState } from 'react';
import { usePostfy } from '../../context/PostfyContext';
import { copyToClipboard as safeCopyToClipboard } from '../../lib/utils';
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Bot, 
  ArrowRight, 
  Loader2, 
  Hash, 
  Video, 
  FileText,
  Target
} from 'lucide-react';

interface AiCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  initialTheme?: string;
  onApplyCopy?: (copyData: { caption: string; hook: string; cta: string; hashtags: string[]; reelsScript?: string }) => void;
}

export const AiCopyModal: React.FC<AiCopyModalProps> = ({
  isOpen,
  onClose,
  clientId,
  initialTheme = '',
  onApplyCopy
}) => {
  const { clients, generateAiCopy } = usePostfy();
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || clients[0]?.id || '');
  const [theme, setTheme] = useState(initialTheme);
  const [format, setFormat] = useState('carrossel');
  const [platform, setPlatform] = useState('instagram');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    caption: string;
    hook: string;
    cta: string;
    hashtags: string[];
    reelsScript?: string;
  } | null>(null);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    try {
      const data = await generateAiCopy({
        theme,
        format,
        platform,
        clientId: selectedClientId,
        additionalNotes
      });
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, section: string) => {
    await safeCopyToClipboard(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Assistente de Copywriting Estratégico (Gemini AI)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gere ganchos, legendas persuasivas e roteiros alinhados ao tom de voz do cliente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form & Results Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* Client & Format Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Formato
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="carrossel">Carrossel (Instagram)</option>
                <option value="reels">Reels / TikTok (Vídeo curto)</option>
                <option value="post_estatico">Post Estático</option>
                <option value="stories">Sequência de Stories</option>
                <option value="artigo">Artigo LinkedIn</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Rede Social
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
          </div>

          {/* Client Briefing Pill (Auto Injected) */}
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-purple-800 dark:text-purple-300">
                <strong>Tom de Voz da Marca:</strong> {currentClient?.briefing?.brandVoice || 'Profissional e acolhedor'}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-full shrink-0">
              Briefing Ativo
            </span>
          </div>

          {/* Theme Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Tema ou Pauta da Publicação *
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Como escolher a torra de café ideal para método filtrado"
              className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden font-medium"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Instruções extras (opcional)
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Ex: Mencionar desconto de 15% na primeira compra com cupom AURA15"
              className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 outline-hidden"
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !theme.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:from-purple-800 active:to-indigo-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Consultando IA e Briefing da Marca...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Gerar Copy e Estratégia Completa</span>
              </>
            )}
          </button>

          {/* Results Display */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              
              {/* Hook Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    🎯 Gancho Inicial / Capa (Hook)
                  </span>
                  <button
                    onClick={() => copyToClipboard(result.hook, 'hook')}
                    className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    {copiedSection === 'hook' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSection === 'hook' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                  {result.hook}
                </p>
              </div>

              {/* Caption Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    Legenda Completa
                  </span>
                  <button
                    onClick={() => copyToClipboard(result.caption, 'caption')}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    {copiedSection === 'caption' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSection === 'caption' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                  {result.caption}
                </div>
              </div>

              {/* CTA and Hashtags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="font-bold text-slate-400 block mb-1">Chamada para Ação (CTA)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{result.cta}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="font-bold text-slate-400 block mb-1">Hashtags Estratégicas</span>
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags?.map((tag, i) => (
                      <span key={i} className="text-[10px] text-purple-600 font-medium">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reels Script if generated */}
              {result.reelsScript && (
                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-1 text-xs">
                  <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    Roteiro Sugerido para Vídeo / Reels
                  </span>
                  <p className="text-[11px] text-indigo-950 dark:text-indigo-200 whitespace-pre-line leading-relaxed">
                    {result.reelsScript}
                  </p>
                </div>
              )}

              {/* Apply into Job button */}
              {onApplyCopy && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyCopy(result);
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Aplicar esta Copy no Job Atual</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

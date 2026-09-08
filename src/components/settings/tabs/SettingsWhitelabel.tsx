import React, { useState, useEffect } from 'react';
import { Paintbrush, CheckCircle2, Building2, Sparkles, Globe, Eye } from 'lucide-react';
import { FileUpload } from '../../ui/file-upload';
import { usePostfy } from '../../../context/PostfyContext';

export const SettingsWhitelabel: React.FC = () => {
  const { currentWorkspace, updateCurrentWorkspace } = usePostfy();

  const [agencyName, setAgencyName] = useState(currentWorkspace?.name || '');
  const [logoUrl, setLogoUrl] = useState(currentWorkspace?.logo || '');
  const [faviconUrl, setFaviconUrl] = useState(currentWorkspace?.favicon || '');
  const [primaryColor, setPrimaryColor] = useState(currentWorkspace?.primaryColor || '#9333ea');
  const [secondaryColor, setSecondaryColor] = useState(currentWorkspace?.secondaryColor || '#ea580c');
  const [customDomain, setCustomDomain] = useState(currentWorkspace?.customDomain || 'portal.suaagencia.com.br');
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when currentWorkspace changes
  useEffect(() => {
    if (currentWorkspace) {
      setAgencyName(currentWorkspace.name || '');
      setLogoUrl(currentWorkspace.logo || '');
      setFaviconUrl(currentWorkspace.favicon || '');
      setPrimaryColor(currentWorkspace.primaryColor || '#9333ea');
      setSecondaryColor(currentWorkspace.secondaryColor || '#ea580c');
      setCustomDomain(currentWorkspace.customDomain || 'portal.suaagencia.com.br');
    }
  }, [currentWorkspace]);

  // Real-time CSS live update while picking colors
  useEffect(() => {
    if (primaryColor && primaryColor.startsWith('#')) {
      document.documentElement.style.setProperty('--brand-primary', primaryColor);
    }
    if (secondaryColor && secondaryColor.startsWith('#')) {
      document.documentElement.style.setProperty('--brand-secondary', secondaryColor);
    }
  }, [primaryColor, secondaryColor]);

  const handleSave = () => {
    setIsSaving(true);
    updateCurrentWorkspace({
      name: agencyName.trim() || currentWorkspace.name,
      logo: logoUrl,
      favicon: faviconUrl,
      primaryColor,
      secondaryColor,
      customDomain: customDomain.trim(),
      whiteLabel: true,
    });

    setSavedFeedback('Configurações salvas e sincronizadas com sucesso no banco de dados!');
    setIsSaving(false);
    setTimeout(() => setSavedFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-purple-600" />
              Whitelabel e Identidade da Agência
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize a marca, logotipo, favicon e cores aplicadas em todo o sistema e no portal dos clientes.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
            Workspace: {currentWorkspace.name}
          </span>
        </div>

        {savedFeedback && (
          <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{savedFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Agência / Workspace
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={agencyName} 
                onChange={(e) => setAgencyName(e.target.value)} 
                placeholder="Ex: Vanguarda Social Ops" 
                className="w-full text-sm p-2.5 pl-9 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
              />
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <FileUpload
              label="Logo Oficial da Agência"
              compact
              imageOnly
              helperText="Suporta SVG, PNG, JPG, WEBP, AVIF, ICO (até 25MB)"
              value={logoUrl}
              onFileSelect={(file) => setLogoUrl(file.url)}
              onFileRemove={() => setLogoUrl('')}
            />
          </div>
          <div>
            <FileUpload
              label="Favicon do Portal / Navegador"
              compact
              imageOnly
              helperText="Suporta SVG, ICO, PNG, WEBP (até 25MB)"
              value={faviconUrl}
              onFileSelect={(file) => setFaviconUrl(file.url)}
              onFileRemove={() => setFaviconUrl('')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cor Primária do Sistema (Hex)</label>
            <div className="flex gap-2">
              <input 
                type="color" 
                value={primaryColor} 
                onChange={(e) => setPrimaryColor(e.target.value)} 
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700" 
              />
              <input 
                type="text" 
                value={primaryColor} 
                onChange={(e) => setPrimaryColor(e.target.value)} 
                placeholder="#6366F1"
                className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white uppercase font-mono" 
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-medium">Sugestões:</span>
              {[
                { name: 'Índigo', color: '#6366F1' },
                { name: 'Roxo Postfy', color: '#9333EA' },
                { name: 'Azul Real', color: '#2563EB' },
                { name: 'Verde Esmeralda', color: '#059669' },
                { name: 'Rosa Magenta', color: '#E11D48' },
                { name: 'Laranja Vibrante', color: '#EA580C' },
                { name: 'Grafite Moderno', color: '#334155' },
              ].map(preset => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setPrimaryColor(preset.color)}
                  title={preset.name}
                  className="w-5 h-5 rounded-full border border-white dark:border-slate-850 shadow-xs hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: preset.color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cor Secundária / Acentos (Hex)</label>
            <div className="flex gap-2">
              <input 
                type="color" 
                value={secondaryColor} 
                onChange={(e) => setSecondaryColor(e.target.value)} 
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700" 
              />
              <input 
                type="text" 
                value={secondaryColor} 
                onChange={(e) => setSecondaryColor(e.target.value)} 
                placeholder="#EA580C"
                className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white uppercase font-mono" 
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-medium">Sugestões:</span>
              {[
                { name: 'Laranja', color: '#EA580C' },
                { name: 'Âmbar', color: '#D97706' },
                { name: 'Ciano', color: '#0284C7' },
                { name: 'Esmeralda', color: '#10B981' },
                { name: 'Púrpura', color: '#7C3AED' },
              ].map(preset => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setSecondaryColor(preset.color)}
                  title={preset.name}
                  className="w-5 h-5 rounded-full border border-white dark:border-slate-850 shadow-xs hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: preset.color }}
                />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Customizado (Aprovação de Clientes)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-300 dark:border-slate-700 rounded-l-lg">
                https://
              </span>
              <input 
                type="text" 
                value={customDomain} 
                onChange={(e) => setCustomDomain(e.target.value)} 
                className="w-full text-sm p-2.5 border border-slate-300 dark:border-slate-700 rounded-none rounded-r-lg bg-transparent text-slate-900 dark:text-white font-mono" 
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Conecte seu domínio próprio e tenha uma experiência 100% customizável para seus clientes.</p>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5" />
              Pré-visualização do Topo e Marca
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
              Atualização em tempo real
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shrink-0">
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {(agencyName || 'P').substring(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {agencyName || 'Propofy Ops'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                    PRO
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">OS para Agências</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {faviconUrl && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <img src={faviconUrl} alt="Favicon" className="w-3.5 h-3.5 object-contain rounded" />
                  <span>Favicon Ativo</span>
                </div>
              )}
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: primaryColor }} 
                title={`Cor Primária: ${primaryColor}`}
              />
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: secondaryColor }} 
                title={`Cor Secundária: ${secondaryColor}`}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-sm shadow-purple-600/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Identidade'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

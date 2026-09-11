import React from 'react';
import type { CampoDoCanal } from '../../lib/camposDoCanal';
import { FileUpload } from '../ui/file-upload';

/**
 * Desenha um campo do catálogo da rede.
 *
 * Existe para o formulário percorrer uma lista em vez de acumular
 * `if (platform === 'youtube')` — rede nova entra no catálogo e aparece aqui
 * sem tocar em componente.
 */
export const CampoDinamico: React.FC<{
  campo: CampoDoCanal;
  valor: unknown;
  onChange: (valor: unknown) => void;
}> = ({ campo, valor, onChange }) => {
  const rotulo = (
    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
      {campo.rotulo}
    </label>
  );

  const ajuda = campo.ajuda ? (
    <p className="mt-1 text-[11px] text-slate-400">{campo.ajuda}</p>
  ) : null;

  const classeDeEntrada =
    'w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white';

  if (campo.tipo === 'booleano') {
    return (
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(valor)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-purple-600 cursor-pointer"
        />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {campo.rotulo}
        </span>
      </label>
    );
  }

  if (campo.tipo === 'selecao') {
    return (
      <div>
        {rotulo}
        <select
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={`${classeDeEntrada} cursor-pointer`}
        >
          {/* Vazio primeiro: sem ele o navegador escolheria a primeira opção
              sozinho, e o campo diria uma escolha que ninguém fez. */}
          <option value="">Selecione...</option>
          {(campo.opcoes || []).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        {ajuda}
      </div>
    );
  }

  if (campo.tipo === 'midia') {
    return (
      <div>
        <FileUpload
          label={campo.rotulo}
          compact
          imageOnly
          value={String(valor ?? '')}
          onFileSelect={(arquivo) => onChange(arquivo.url)}
          onFileRemove={() => onChange('')}
        />
        {ajuda}
      </div>
    );
  }

  if (campo.tipo === 'textoLongo') {
    return (
      <div>
        {rotulo}
        <textarea
          rows={campo.linhas ?? 4}
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.exemplo}
          className={`${classeDeEntrada} leading-relaxed`}
        />
        {ajuda}
      </div>
    );
  }

  return (
    <div>
      {rotulo}
      <input
        type="text"
        value={String(valor ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={campo.exemplo}
        className={classeDeEntrada}
      />
      {ajuda}
    </div>
  );
};

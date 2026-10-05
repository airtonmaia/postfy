import React from 'react';
import { Facebook, Instagram } from 'lucide-react';

import type { ContaConectada } from '../../lib/redes';

/**
 * A foto do perfil conectado, com o selo da rede no canto.
 *
 * **Mora aqui porque duas telas mostram a mesma conta**: a lista da agência,
 * em Configurações › Integrações, e a ficha do cliente, em Conexões do perfil.
 * Duas cópias divergem na primeira pressa — é a história das doze alturas de
 * botão e das sete barras de abas —, e divergir *aqui* seria caro de um jeito
 * específico: a mesma conta lida de dois jeitos faz quem confere achar que são
 * conexões diferentes.
 *
 * **A foto vem antes do texto porque é assim que se reconhece um perfil.** Quem
 * administra contas de nomes parecidos ("Loja", "Loja Oficial") reconhece a
 * imagem antes de ler o arroba — e conectar a errada só aparece quando o post
 * do cliente sai no perfil de outro negócio, que é tarde.
 *
 * **Sem foto, o ícone da rede ocupa o lugar.** Conexão feita antes de a foto
 * ser guardada não tem nenhuma, e um círculo cinza vazio leria como falha de
 * carregamento — algo quebrado, em vez de algo que não foi medido.
 */

const ICONES: Record<ContaConectada['platform'], React.FC<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
};

/** A cor de marca de cada rede, para o selo ser reconhecido de relance. */
const CORES: Record<ContaConectada['platform'], string> = {
  instagram: 'text-[#E4405F]',
  facebook: 'text-[#1877F2]',
};

export const AvatarDaConexao: React.FC<{
  platform: ContaConectada['platform'];
  fotoUrl?: string;
  /** `sm` na lista da agência, `md` na ficha do cliente. */
  tamanho?: 'sm' | 'md';
}> = ({ platform, fotoUrl, tamanho = 'md' }) => {
  const Icone = ICONES[platform];
  const cor = CORES[platform];
  const caixa = tamanho === 'sm' ? 'w-8 h-8' : 'w-9 h-9';

  if (!fotoUrl) {
    return (
      <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0 ${cor}`}>
        <Icone className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <img
        src={fotoUrl}
        alt=""
        className={`${caixa} rounded-full object-cover border border-slate-200 dark:border-slate-700`}
      />
      {/* O selo acompanha a foto porque, sozinha, ela não diz de qual rede é a
          conexão — e essa é a primeira informação da linha. */}
      <span
        className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-white dark:bg-slate-900 ${cor}`}
      >
        <Icone className="w-3 h-3" />
      </span>
    </div>
  );
};

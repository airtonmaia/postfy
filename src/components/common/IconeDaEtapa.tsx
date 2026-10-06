import React from 'react';
import {
  Lightbulb,
  ClipboardList,
  PenLine,
  Palette,
  Camera,
  Clapperboard,
  Eye,
  MessageSquare,
  RotateCcw,
  CheckCircle2,
  CalendarClock,
  Send,
  Rocket,
  Megaphone,
} from 'lucide-react';

import { ICONES_DA_ETAPA } from '../../lib/fluxoDeProducao';

/**
 * A chave guardada no banco virando desenho.
 *
 * **A lista de chaves mora em `fluxoDeProducao.ts` e o desenho mora aqui**, e
 * essa separação é o que mantém a regra testável: aquele módulo é dado puro —
 * `sanearFluxo` e `etapasDoFluxo` rodam em teste sem montar componente
 * nenhum —, e importar React ali levaria a árvore de ícones junto para dentro
 * de uma função que só decide strings.
 *
 * O preço é que as duas listas podem divergir, e divergir aqui **não quebra
 * nada visível**: a etapa fica sem ícone, com a tela desenhada e um buraco
 * onde a pessoa escolheu alguma coisa. Por isso a guarda exige que toda chave
 * de `ICONES_DA_ETAPA` tenha entrada neste mapa — e que este mapa não tenha
 * chave que a lista não ofereça, que é a mesma divergência do outro lado.
 */
const DESENHO: Record<string, React.ComponentType<{ className?: string }>> = {
  ideia: Lightbulb,
  prancheta: ClipboardList,
  texto: PenLine,
  design: Palette,
  camera: Camera,
  video: Clapperboard,
  olho: Eye,
  conversa: MessageSquare,
  voltar: RotateCcw,
  conferido: CheckCircle2,
  calendario: CalendarClock,
  enviar: Send,
  foguete: Rocket,
  megafone: Megaphone,
};

/**
 * Chave desconhecida cai no primeiro da lista, nunca em nada.
 *
 * Um `null` aqui deixaria a coluna com um buraco do tamanho do ícone e o
 * título deslocado em relação às vizinhas — pior que mostrar o ícone errado,
 * porque parece defeito do quadro em vez de escolha de configuração.
 */
export const IconeDaEtapa: React.FC<{ chave: string; className?: string }> = ({
  chave,
  className = 'w-3 h-3',
}) => {
  const Desenho = DESENHO[chave] ?? DESENHO[ICONES_DA_ETAPA[0].valor];
  return <Desenho className={className} />;
};

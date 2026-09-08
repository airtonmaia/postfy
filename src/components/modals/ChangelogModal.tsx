import React from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  Calendar, 
  Smartphone, 
  BarChart3, 
  Upload, 
  ShieldCheck, 
  Webhook, 
  Layers, 
  FileText,
  Clock,
  ArrowRight,
  Zap,
  Rocket
} from 'lucide-react';

interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  tag: string;
  icon: React.ElementType;
  color: string;
  description: string;
  highlights: string[];
}

const CHANGELOG_DATA: ChangelogItem[] = [
  {
    version: 'v2.5.0',
    date: 'Hoje (Novo)',
    title: 'Componentes de Upload Shadcn/UI em Todo o Sistema',
    tag: 'Design & Usabilidade',
    icon: Upload,
    color: 'from-purple-600 to-indigo-600',
    description: 'Substituição de todos os campos manuais de link por componentes unificados de Upload estilo Shadcn/UI com Drag & Drop, suporte a arquivos locais (PDF, Imagens, Vídeos, Documentos), pré-visualização instantânea e fallback para links na nuvem.',
    highlights: [
      'Área de Upload Drag & Drop moderna nos detalhes do cliente (Arquivos, Pastas e Notas Fiscais).',
      'Upload direto de logotipo / avatar no cadastro de novos clientes e nas configurações de Whitelabel.',
      'Central de fotos e materiais do Portal do Cliente atualizada com o novo componente.',
      'Envio de novas versões e refações no modal de detalhes do job com pré-visualização de imagem.'
    ]
  },
  {
    version: 'v2.4.0',
    date: 'Hoje (Recente)',
    title: 'Portal do Cliente com Login via WhatsApp & Isolamento Completo',
    tag: 'Portal do Cliente',
    icon: Smartphone,
    color: 'from-emerald-500 to-teal-600',
    description: 'Experiência exclusiva para os clientes da agência com autenticação via telefone WhatsApp, tela de login personalizada e visualização restrita exclusivamente aos seus próprios conteúdos.',
    highlights: [
      'Tela de Login moderna com seletor internacional de DDI (+55 Brasil) e máscara automática.',
      'Isolamento total de dados: cada cliente só visualiza suas próprias aprovações, cronograma e arquivos.',
      'Exibição do nome completo do cliente (ex: Dr. Cristiane Serafim).',
      'Remoção de links internos da agência na visão do cliente para máxima privacidade.'
    ]
  },
  {
    version: 'v2.3.0',
    date: 'Hoje (Recente)',
    title: 'Painel de Relatórios & BI com Exportação em PDF',
    tag: 'Métricas & BI',
    icon: BarChart3,
    color: 'from-purple-500 to-indigo-600',
    description: 'Dashboard analítico completo com métricas de tempo de ciclo, taxa de aprovação de primeira, volume por cliente e exportação de relatório executivo em PDF.',
    highlights: [
      'Gráficos interativos com filtros dinâmicos de período (7d, 30d, mês, trimestre e ano).',
      'Cálculo automático de taxa de refação por responsável e identificação de gargalos.',
      'Geração de relatório em PDF em 1 clique com cabeçalho institucional da agência.'
    ]
  },
  {
    version: 'v2.2.0',
    date: 'Hoje (Recente)',
    title: 'Central de Upload de Mídias Persistente (Drag & Drop)',
    tag: 'Mídias & Criativos',
    icon: Upload,
    color: 'from-blue-500 to-cyan-600',
    description: 'Suporte a envio de imagens e criativos direto do computador via drag-and-drop, com persistência automática no Google Firestore e suporte a múltiplos criativos (carrossel).',
    highlights: [
      'Conversão e salvamento de imagens em alta fidelidade no banco de dados da nuvem.',
      'Galeria com thumbnails expansíveis, reordenação e exclusão instantânea.',
      'Suporte a links externos de alta resolução (Google Drive, Canva e Figma).'
    ]
  },
  {
    version: 'v2.1.0',
    date: 'Hoje (Recente)',
    title: 'Integração Google Firebase Firestore em Tempo Real',
    tag: 'Infraestrutura',
    icon: ShieldCheck,
    color: 'from-amber-500 to-orange-600',
    description: 'Persistência instantânea na nuvem do Google com regras de segurança e sincronização reativa para todos os membros da equipe.',
    highlights: [
      'Sincronização bidirecional de cards Kanban, briefings, notas fiscais e senhas.',
      'Plano Gratuito com 5 GB de arquivos e suporte a mais de 100.000 posts e registros.',
      'Histórico de alterações e auditoria de aprovações com registro de data/hora.'
    ]
  },
  {
    version: 'v2.0.0',
    date: 'Recente',
    title: 'Automações & Webhooks (Zapier, Make, n8n)',
    tag: 'Integrações',
    icon: Webhook,
    color: 'from-fuchsia-500 to-pink-600',
    description: 'Disparos automáticos de eventos de webhook para conectar a agência ao WhatsApp, ERPs externos e ferramentas de agendamento.',
    highlights: [
      'Disparos em eventos de aprovação, solicitação de ajuste e postagem agendada.',
      'Editor de endpoints com visualizador de histórico de chamadas HTTP.'
    ]
  }
];

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50/60 to-indigo-50/40 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Central de Novidades & Atualizações
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  Changelog
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhe as últimas funcionalidades e melhorias implementadas no Postfy OS.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of updates */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {CHANGELOG_DATA.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={item.version} className={`space-y-3 ${idx !== 0 ? 'pt-6' : ''}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${item.color} text-white shadow-xs`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{item.version}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.tag}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.description}
                </p>

                {/* Highlights */}
                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/60 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    O que há de novo:
                  </span>
                  <ul className="space-y-1.5">
                    {item.highlights.map((h, hIdx) => (
                      <li key={hIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Postfy OS &bull; Sistema atualizado continuamente
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

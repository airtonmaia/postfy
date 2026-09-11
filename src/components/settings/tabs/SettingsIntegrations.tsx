import React from 'react';
import { Instagram, HardDrive, MessageCircle, CircleDashed, CheckCircle2 } from 'lucide-react';
import { ConexoesSociais } from '../../publications/ConexoesSociais';

/**
 * Integrações da agência: as contas que ela conecta.
 *
 * Esta tela mostrava o estado da infraestrutura do produto — banco, chave de
 * IA, credenciais do R2, chave do Resend. Não é assunto de quem usa: são
 * variáveis de ambiente que o dono do SaaS controla, iguais para toda a base,
 * e ver "requer configuração" ali só gerava dúvida sobre algo que a agência
 * não pode resolver. Isso foi para a área /admin.
 *
 * O que sobra aqui é o que de fato pertence à agência: autorizar a conta de
 * Instagram do cliente para agendar, buscar mídia do Drive dele. São conexões
 * por consentimento, uma por cliente, e cada uma vale só para quem conectou.
 */

const PLANEJADAS: { nome: string; desc: string; Icone: React.FC<{ className?: string }> }[] = [
  {
    nome: 'Google Drive',
    desc: 'Puxar fotos e vídeos direto da pasta do cliente, sem baixar e subir de novo.',
    Icone: HardDrive,
  },
  {
    nome: 'WhatsApp API (Cloud, Evolution ou Z-API)',
    desc: 'Avisar o cliente por WhatsApp quando houver conteúdo esperando aprovação.',
    Icone: MessageCircle,
  },
];

export const SettingsIntegrations: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
        Contas conectadas
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
        Autorize as contas dos seus clientes para o Orquesia agendar publicações e
        buscar arquivos. Cada conexão vale só para esta agência, e pode ser
        revogada a qualquer momento.
      </p>
    </div>

    <ConexoesSociais />

    {/* Compartilhamento por WhatsApp: não precisa de conexão, então fica como
        informação e não como algo a configurar. */}
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Compartilhamento por WhatsApp
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              Abre o WhatsApp com o link de aprovação já preenchido. Não exige conexão
              nem API oficial — funciona pelo aplicativo que você já usa.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Em funcionamento
        </span>
      </div>
    </div>

    {/* O que ainda não existe fica visível, mas sem botão: um botão que não
        faz nada é a promessa vazia que esta tela já fez no passado. */}
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-white">Em construção</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Ainda não dá para conectar. Está aqui para você saber o que vem.
        </p>
      </div>

      {PLANEJADAS.map(({ nome, desc, Icone }) => (
        <div
          key={nome}
          className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Icone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{nome}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <CircleDashed className="w-3 h-3" />
            Não implementada
          </span>
        </div>
      ))}
    </div>

    <p className="text-[11px] text-slate-400 dark:text-slate-500">
      <Instagram className="w-3 h-3 inline mr-1 -mt-0.5" />
      Publicar no Instagram depende de aprovação do app na Meta, que é um processo
      externo e leva algumas semanas. A conexão já pode ser feita e testada antes disso.
    </p>
  </div>
);

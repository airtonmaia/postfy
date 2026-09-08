# POSTFY — Architecture & Technical Design

## Stack & Camadas
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4.
- **UI Components & Icons**: shadcn/ui design patterns, Lucide React, Plus Jakarta Sans typography.
- **Calendário Editorial**: Arquitetura inspirada no shadcnuikit calendar app (`https://shadcnuikit.com/dashboard/apps/calendar`) com suporte a visão Mês, Semana, Dia e Lista, filtros por clientes, redes sociais, status, e mini-picker lateral.
- **State & Domain**: Multi-tenant state engine com persistência local reativa, suporte a múltiplos workspaces, isolamento de dados e Portal do Cliente desacoplado com visualização externa.
- **Módulos Principais**:
  - `src/types/`: Definições tipadas de todas as entidades (Workspace, User, Client, Job, Version, Approval, Calendar, Lead, Proposal, Contract, Automation).
  - `src/data/initialData.ts`: Dados realistas e estruturados para agências reais (Vanguarda Digital, Nova Studio), com dezenas de conteúdos, histórico de versões, métricas e clientes reais.
  - `src/context/PostfyContext.tsx`: Store central multi-tenant com operações de CRUD, workflows de aprovação, transições de status e notificações.
  - `src/components/calendar/`: Calendário editorial avançado shadcn style (Month, Week, Day, List, Mini Calendar, Filters, Event Modal).
  - `src/components/kanban/`: Quadro Kanban com drag-and-drop / transições de status e visualização de jobs.
  - `src/components/portal/`: Portal do Cliente externo (white-label ready, mobile optimized).
  - `src/components/dashboard/`: Dashboard executivo com indicador "Saúde da Agência" (0-100), KPIs e gráficos.
  - `src/components/commercial/`: CRM de Leads, Gerador de Propostas e Contratos.

-- =======================================================
-- POSTFY (AGENCY OS) - SUPABASE POSTGRESQL SCHEMA
-- Execute este script no SQL Editor do seu projeto Supabase
-- =======================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    name TEXT NOT NULL,
    legal_name TEXT,
    trade_name TEXT,
    cpf_cnpj TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    segment TEXT,
    website TEXT,
    internal_responsible_id TEXT,
    health_score TEXT NOT NULL DEFAULT 'green' CHECK (health_score IN ('green', 'yellow', 'red')),
    portal_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    services JSONB DEFAULT '[]'::jsonb,
    contacts JSONB DEFAULT '[]'::jsonb,
    briefing JSONB DEFAULT '{}'::jsonb,
    passwords JSONB DEFAULT '[]'::jsonb,
    invoices JSONB DEFAULT '[]'::jsonb,
    files JSONB DEFAULT '[]'::jsonb
);

-- 3. Tabela de Tarefas / Conteúdos (Jobs)
CREATE TABLE IF NOT EXISTS public.jobs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    caption TEXT,
    cta TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'pinterest')),
    format TEXT NOT NULL CHECK (format IN ('feed', 'carrossel', 'reels', 'stories', 'artigo', 'video', 'shorts')),
    status TEXT NOT NULL CHECK (status IN ('ideia', 'briefing', 'redacao', 'design', 'revisao_interna', 'aprovacao_cliente', 'ajuste_solicitado', 'aprovado', 'agendado', 'publicado')),
    publish_date DATE NOT NULL,
    publish_time TEXT DEFAULT '18:00',
    deadline TIMESTAMP WITH TIME ZONE,
    priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
    media_urls JSONB DEFAULT '[]'::jsonb,
    current_version INTEGER DEFAULT 1,
    versions JSONB DEFAULT '[]'::jsonb,
    designer_id TEXT,
    copywriter_id TEXT,
    social_media_id TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    comments JSONB DEFAULT '[]'::jsonb,
    last_feedback TEXT,
    timesheet_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Leads Comerciais
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'Indicação',
    service_interest TEXT,
    estimated_value NUMERIC DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'new_lead',
    responsible_id TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Propostas Comerciais
CREATE TABLE IF NOT EXISTS public.proposals (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    lead_id TEXT,
    client_id TEXT,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_monthly_value NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected')),
    valid_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- 6. Tabela de Contratos
CREATE TABLE IF NOT EXISTS public.contracts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    monthly_value NUMERIC NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')),
    signed_at TIMESTAMP WITH TIME ZONE,
    signatory_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabela de Materiais Enviados pelo Cliente (Fotos, Vídeos, Documentos)
CREATE TABLE IF NOT EXISTS public.client_materials (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-1',
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size TEXT,
    status TEXT DEFAULT 'recebido' CHECK (status IN ('recebido', 'em_analise', 'utilizado', 'arquivado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Tabela de Apontamentos de Horas (Timesheet)
CREATE TABLE IF NOT EXISTS public.timesheet_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_jobs_client ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_publish_date ON public.jobs(publish_date);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);

-- Políticas RLS (Row Level Security) básicas
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total autenticado para clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para jobs" ON public.jobs FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para proposals" ON public.proposals FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para contracts" ON public.contracts FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para client_materials" ON public.client_materials FOR ALL USING (true);
CREATE POLICY "Acesso total autenticado para timesheet_logs" ON public.timesheet_logs FOR ALL USING (true);

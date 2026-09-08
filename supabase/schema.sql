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
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter')),
    format TEXT NOT NULL CHECK (format IN ('feed', 'carousel', 'reel', 'story', 'video', 'article')),
    status TEXT NOT NULL CHECK (status IN ('ideas', 'in_production', 'for_approval', 'in_adjustment', 'approved', 'scheduled', 'published')),
    publish_date DATE NOT NULL,
    publish_time TEXT DEFAULT '18:00',
    deadline TIMESTAMP WITH TIME ZONE,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
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
    status TEXT DEFAULT 'recebido' CHECK (status IN ('recebido', 'utilizado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Tabela de Apontamentos de Horas (Timesheet)
CREATE TABLE IF NOT EXISTS public.timesheet_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
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

-- =======================================================
-- Multi-tenant: associação usuário -> workspace
-- =======================================================
-- O isolamento depende desta tabela: ela diz a quais workspaces cada usuário
-- autenticado (auth.users do Supabase) pertence.
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner'
        CHECK (role IN ('owner','admin','manager','social_media','designer','copywriter','financial','client')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- SECURITY DEFINER + search_path fixo: a função precisa ler workspace_members
-- ignorando a RLS da própria tabela, senão a política se referencia em loop.
CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_workspace_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.current_workspace_ids() TO authenticated;

-- =======================================================
-- Row Level Security
-- =======================================================
-- ATENÇÃO: a versão anterior deste arquivo habilitava RLS e em seguida criava
-- políticas `USING (true)`, o que anula a proteção — qualquer portador da chave
-- anônima lia e escrevia a base inteira. As políticas abaixo recortam todo
-- acesso pelos workspaces do usuário autenticado.

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_logs ENABLE ROW LEVEL SECURITY;

-- Cada usuário enxerga apenas os próprios vínculos.
DROP POLICY IF EXISTS "membros veem os proprios vinculos" ON public.workspace_members;
CREATE POLICY "membros veem os proprios vinculos"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Uma política por tabela, cobrindo leitura e escrita.
-- USING controla o que pode ser lido/alterado; WITH CHECK impede gravar uma
-- linha carimbada com o workspace de outra agência.
DO $$
DECLARE
    tabela TEXT;
BEGIN
    FOREACH tabela IN ARRAY ARRAY[
        'clients','jobs','leads','proposals','contracts','client_materials','timesheet_logs'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "isolamento por workspace" ON public.%I', tabela);
        EXECUTE format($f$
            CREATE POLICY "isolamento por workspace"
                ON public.%I
                FOR ALL
                TO authenticated
                USING (workspace_id IN (SELECT public.current_workspace_ids()))
                WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()))
        $f$, tabela);
    END LOOP;
END
$$;

-- A chave anônima não deve alcançar nenhuma tabela de negócio.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON public.jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON public.leads(workspace_id);

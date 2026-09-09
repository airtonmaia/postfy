import { describe, it, expect } from 'vitest';
import {
  clientDaLinha, clientParaLinha,
  jobDaLinha, jobParaLinha,
  contractDaLinha, contractParaLinha,
  automationDaLinha,
  activityLogDaLinha,
  clientMaterialDaLinha,
  workspaceDaLinha,
} from '../src/lib/mappers';
import type { Job, Client } from '../src/types';

/**
 * Os mapeadores são o ponto onde um nome de campo errado some com o dado sem
 * erro nenhum: o Postgres ignora coluna desconhecida no retorno e o app lê
 * `undefined`. Por isso o ida-e-volta é testado campo a campo.
 */

describe('client', () => {
  const linha = {
    id: 'c-1',
    workspace_id: 'ws-1',
    name: 'Café Aroma',
    legal_name: 'Aroma Ltda',
    trade_name: 'Aroma',
    cpf_cnpj: '12.345.678/0001-90',
    email: 'a@b.com',
    phone: '(11) 99999-0000',
    avatar: 'https://x/y.png',
    status: 'active',
    segment: 'Gastronomia',
    website: 'https://aroma.com',
    internal_responsible_id: 'u-4',
    health_score: 'yellow',
    notes: 'Cliente exigente',
    portal_token: 'tok-abc',
    services: [{ id: 's-1' }],
    contacts: [{ id: 'ct-1' }],
    briefing: { brandVoice: 'Acolhedor' },
    passwords: [],
    invoices: [],
    files: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  it('traduz todos os campos vindos do banco', () => {
    const c = clientDaLinha(linha);
    expect(c.workspaceId).toBe('ws-1');
    expect(c.legalName).toBe('Aroma Ltda');
    expect(c.tradeName).toBe('Aroma');
    expect(c.cpfCnpj).toBe('12.345.678/0001-90');
    expect(c.internalResponsibleId).toBe('u-4');
    expect(c.healthScore).toBe('yellow');
    expect(c.portalToken).toBe('tok-abc');
    expect(c.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(c.briefing).toEqual({ brandVoice: 'Acolhedor' });
  });

  it('não deixa null escapar como valor para a interface', () => {
    const c = clientDaLinha({ ...linha, legal_name: null, website: null, notes: null });
    expect(c.legalName).toBeUndefined();
    expect(c.website).toBeUndefined();
    expect(c.notes).toBeUndefined();
  });

  it('preenche coleções ausentes com array vazio, não undefined', () => {
    const c = clientDaLinha({ id: 'c', workspace_id: 'w', name: 'X', portal_token: 't' });
    expect(c.services).toEqual([]);
    expect(c.contacts).toEqual([]);
    expect(c.files).toEqual([]);
  });

  it('volta para o banco com os nomes de coluna certos', () => {
    const l = clientParaLinha({
      workspaceId: 'ws-9',
      legalName: 'Razão Social',
      cpfCnpj: '000',
      healthScore: 'red',
      internalResponsibleId: 'u-1',
    } as Partial<Client>);
    expect(l.workspace_id).toBe('ws-9');
    expect(l.legal_name).toBe('Razão Social');
    expect(l.cpf_cnpj).toBe('000');
    expect(l.health_score).toBe('red');
    expect(l.internal_responsible_id).toBe('u-1');
  });

  it('omite campos não informados, para não sobrescrever com undefined', () => {
    const l = clientParaLinha({ name: 'Só o nome' });
    expect(Object.keys(l)).toEqual(['name']);
  });
});

describe('job', () => {
  const linha = {
    id: 'j-1',
    workspace_id: 'ws-1',
    client_id: 'c-1',
    title: 'Carrossel',
    campaign: 'Lançamento',
    platform: 'instagram',
    format: 'carousel',
    status: 'for_approval',
    priority: 'high',
    target_audience: 'Empreendedores',
    funnel_stage: 'topo',
    caption: 'Legenda',
    cta: 'Comente',
    hashtags: ['#a'],
    first_comment: 'Primeiro',
    link: 'https://x',
    media_urls: ['https://img'],
    current_version: 2,
    versions: [{ versionNumber: 1 }],
    checklist: [{ id: 'ck-1' }],
    comments: [{ id: 'cm-1' }],
    designer_id: 'u-2',
    copywriter_id: 'u-3',
    social_media_id: 'u-4',
    last_feedback: 'Trocar cor',
    timesheet_minutes: 45,
    scheduled_date: '2026-03-01T18:00:00Z',
    deadline_production: '2026-02-25T00:00:00Z',
    deadline_approval: '2026-02-27T00:00:00Z',
    published_date: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('traduz os campos que antes não tinham coluna', () => {
    const j = jobDaLinha(linha);
    expect(j.campaign).toBe('Lançamento');
    expect(j.targetAudience).toBe('Empreendedores');
    expect(j.funnelStage).toBe('topo');
    expect(j.firstComment).toBe('Primeiro');
    expect(j.link).toBe('https://x');
  });

  it('traduz responsáveis, versões e prazos', () => {
    const j = jobDaLinha(linha);
    expect(j.designerId).toBe('u-2');
    expect(j.copywriterId).toBe('u-3');
    expect(j.socialMediaId).toBe('u-4');
    expect(j.currentVersion).toBe(2);
    expect(j.mediaUrls).toEqual(['https://img']);
    expect(j.lastFeedback).toBe('Trocar cor');
    expect(j.timesheetMinutes).toBe(45);
    expect(j.scheduledDate).toBe('2026-03-01T18:00:00Z');
    expect(j.deadlineProduction).toBe('2026-02-25T00:00:00Z');
    expect(j.publishedDate).toBeUndefined();
  });

  // Data vazia num campo timestamptz faz o Postgres recusar a linha inteira.
  it('converte data vazia para null em vez de string vazia', () => {
    const l = jobParaLinha({ scheduledDate: '', deadlineProduction: '   ' } as Partial<Job>);
    expect(l.scheduled_date).toBeNull();
    expect(l.deadline_production).toBeNull();
  });

  it('preserva data preenchida', () => {
    const l = jobParaLinha({ scheduledDate: '2026-03-01T18:00:00Z' } as Partial<Job>);
    expect(l.scheduled_date).toBe('2026-03-01T18:00:00Z');
  });

  it('não inclui data que não foi informada', () => {
    const l = jobParaLinha({ title: 'X' } as Partial<Job>);
    expect('scheduled_date' in l).toBe(false);
  });
});

describe('contract', () => {
  // signatoryName não existia no tipo, então o nome de quem assinou era
  // descartado: o contrato ficava assinado sem registro de por quem.
  it('preserva quem assinou, nos dois sentidos', () => {
    const c = contractDaLinha({
      id: 'k-1', workspace_id: 'w', client_name: 'X', title: 'T',
      signatory_name: 'Maria Silva', signed_at: '2026-02-01T00:00:00Z', status: 'signed',
    });
    expect(c.signatoryName).toBe('Maria Silva');
    expect(c.signedAt).toBe('2026-02-01T00:00:00Z');

    const l = contractParaLinha({ signatoryName: 'João', status: 'signed' });
    expect(l.signatory_name).toBe('João');
  });
});

describe('demais entidades', () => {
  it('automation usa enabled e executionCount', () => {
    const a = automationDaLinha({
      id: 'a', workspace_id: 'w', title: 'T', trigger: 'x', action: 'y',
      enabled: true, execution_count: 12,
    });
    expect(a.enabled).toBe(true);
    expect(a.executionCount).toBe(12);
    expect(a.title).toBe('T');
  });

  // O tipo chama de timestamp o que no banco é created_at.
  it('activityLog expõe created_at como timestamp', () => {
    const a = activityLogDaLinha({
      id: 'l', workspace_id: 'w', user_name: 'Ana', action: 'Criou',
      target: 'Job', created_at: '2026-01-02T00:00:00Z',
    });
    expect(a.timestamp).toBe('2026-01-02T00:00:00Z');
    expect(a.userName).toBe('Ana');
  });

  it('clientMaterial traduz url, thumbnail e categoria', () => {
    const m = clientMaterialDaLinha({
      id: 'm', workspace_id: 'w', client_id: 'c', title: 'Fotos',
      url: 'https://u', thumbnail_url: 'https://t', category: 'photo',
      status: 'recebido', created_at: '2026-01-01T00:00:00Z',
    });
    expect(m.url).toBe('https://u');
    expect(m.thumbnailUrl).toBe('https://t');
    expect(m.category).toBe('photo');
  });

  it('workspace traduz cor e whitelabel', () => {
    const w = workspaceDaLinha({
      id: 'w', name: 'Ag', slug: 'ag', primary_color: '#000',
      white_label: true, timezone: 'America/Sao_Paulo',
    });
    expect(w.primaryColor).toBe('#000');
    expect(w.whiteLabel).toBe(true);
  });
});

import { supabase } from './supabase';

/**
 * Modelos dos e-mails automáticos do sistema.
 *
 * A RLS só deixa o admin da plataforma ler e alterar. Para qualquer outro
 * usuário a consulta volta vazia — não é preciso checar papel aqui, e não
 * adiantaria: quem decide é o banco.
 */

export interface ModeloDeEmail {
  evento: string;
  nome: string;
  descricao: string;
  destinatario: 'cliente' | 'agencia';
  ativo: boolean;
  assunto: string;
  corpo: string;
  updatedAt: string;
}

const daLinha = (l: any): ModeloDeEmail => ({
  evento: l.evento,
  nome: l.nome,
  descricao: l.descricao,
  destinatario: l.destinatario,
  ativo: l.ativo,
  assunto: l.assunto,
  corpo: l.corpo,
  updatedAt: l.updated_at,
});

export const listarModelos = async (): Promise<ModeloDeEmail[]> => {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('destinatario')
    .order('nome');

  if (error) throw new Error(error.message);
  return (data || []).map(daLinha);
};

export const salvarModelo = async (
  evento: string,
  mudancas: Partial<Pick<ModeloDeEmail, 'ativo' | 'assunto' | 'corpo'>>
): Promise<void> => {
  const { data: sessao } = await supabase.auth.getSession();

  const { error } = await supabase
    .from('email_templates')
    .update({
      ...mudancas,
      updated_at: new Date().toISOString(),
      updated_by: sessao.session?.user?.id ?? null,
    })
    .eq('evento', evento);

  if (error) throw new Error(error.message);
};

/**
 * Variáveis que cada evento oferece.
 *
 * Fica aqui, e não no banco, porque o conjunto depende do que o gatilho
 * consegue preencher no momento do disparo: prometer {{feedback}} num evento
 * que não tem feedback produz e-mail com buraco no texto.
 */
export const VARIAVEIS_POR_EVENTO: Record<string, string[]> = {
  conteudo_aguardando_aprovacao: ['{{cliente}}', '{{agencia}}', '{{titulo}}', '{{link}}'],
  conteudo_aprovado: ['{{cliente}}', '{{agencia}}', '{{titulo}}', '{{link}}'],
  pedido_de_ajuste: ['{{cliente}}', '{{agencia}}', '{{titulo}}', '{{feedback}}', '{{link}}'],
  boas_vindas: ['{{agencia}}', '{{link}}'],
};

/** Troca as variáveis pelo valor real. O que não for informado vira vazio. */
export const preencher = (texto: string, valores: Record<string, string>): string =>
  texto.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? '');

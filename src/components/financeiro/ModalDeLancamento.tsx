import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { useConfirmacao } from '../ui/alert-dialog';
import {
  Lancamento,
  TipoDeLancamento,
  Caixa,
  centavosDe,
  emReais,
  hojeNaAgencia,
} from '../../lib/financeiro';
import type { Client } from '../../types';

/**
 * Cadastrar e editar um lançamento — a receber ou a pagar.
 *
 * **Uma modal só para os dois lados**, pelo mesmo motivo de
 * `FormularioDoConteudo` servir o cadastro e o editor: duas cópias divergem na
 * primeira pressa, e aqui divergir significa um campo existir de um lado e não
 * do outro — a categoria que some de "Pagar" é a categoria que falta no
 * relatório de despesas, sem nada avisando.
 *
 * O que muda entre os dois é **o vocabulário**, não a estrutura: quem recebe
 * tem cliente, quem paga tem fornecedor; "Recebido em" e "Pago em" são a mesma
 * coluna.
 */

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none';

const ROTULO = 'text-xs font-bold text-slate-700 dark:text-slate-300';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  tipo: TipoDeLancamento;
  /** Preenchido, é edição. Vazio, é cadastro. */
  lancamento?: Lancamento | null;
  /** Nasce liquidado — é o caminho de "Entrada"/"Saída" da tela de Caixa. */
  jaLiquidado?: boolean;
  caixaFixo?: string;
  caixas: Caixa[];
  clientes: Client[];
  aoSalvar: (dados: Partial<Lancamento> & { id?: string }) => Promise<void>;
  aoExcluir?: (id: string) => Promise<void>;
}

export const ModalDeLancamento: React.FC<Props> = ({
  aberta,
  aoFechar,
  tipo,
  lancamento,
  jaLiquidado = false,
  caixaFixo,
  caixas,
  clientes,
  aoSalvar,
  aoExcluir,
}) => {
  const { pedir, dialogo } = useConfirmacao();

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [categoria, setCategoria] = useState('');
  const [clientId, setClientId] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [liquidadoEm, setLiquidadoEm] = useState('');
  const [caixaId, setCaixaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /*
    A modal fica montada, então o rascunho precisa ser reposto a cada
    abertura — senão ela abre com os campos do lançamento anterior. O efeito
    depende do `id`, e não do objeto: ele é recriado a cada leitura, e apagaria
    o que a pessoa estivesse digitando.
  */
  useEffect(() => {
    if (!aberta) return;
    const hoje = hojeNaAgencia();
    setDescricao(lancamento?.descricao || '');
    setValor(lancamento ? String(emReais(lancamento.valorCentavos).toFixed(2)).replace('.', ',') : '');
    setVencimento(lancamento?.vencimento || hoje);
    setCategoria(lancamento?.categoria || '');
    setClientId(lancamento?.clientId || '');
    setContraparte(lancamento?.contraparte || '');
    setLiquidadoEm(lancamento?.liquidadoEm || (jaLiquidado ? hoje : ''));
    setCaixaId(lancamento?.caixaId || caixaFixo || '');
    setObservacao(lancamento?.observacao || '');
    setErro(null);
  }, [aberta, lancamento?.id, jaLiquidado, caixaFixo]);

  const centavos = centavosDe(valor);
  const ehReceber = tipo === 'receber';

  const salvar = async () => {
    /*
      `centavosDe` devolve `null` para o que não entendeu, e **null não é
      zero**: aceitar aqui gravaria um lançamento de R$ 0,00 com cara de
      certo. A recusa é a mesma do banco, que tem `check (valor > 0)`.
    */
    if (!centavos || centavos <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar({
        id: lancamento?.id,
        tipo,
        descricao,
        valorCentavos: centavos,
        vencimento,
        categoria,
        clientId: clientId || undefined,
        contraparte,
        liquidadoEm: liquidadoEm || undefined,
        caixaId: liquidadoEm ? caixaId || undefined : undefined,
        observacao,
      });
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent tamanho="formulario" className="p-0 gap-0">
          <div className="shrink-0 p-5 pr-12 border-b border-slate-200 dark:border-slate-800">
            <DialogTitle asChild>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lancamento
                  ? 'Editar lançamento'
                  : ehReceber
                  ? 'Novo recebimento'
                  : 'Nova despesa'}
              </h3>
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {ehReceber
                ? 'O que a agência tem a receber, e de quem.'
                : 'O que a agência tem a pagar, e para quem.'}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {erro && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{erro}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className={ROTULO}>Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={ehReceber ? 'Mensalidade de outubro' : 'Assinatura do Canva'}
                className={CAMPO}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={ROTULO}>Valor</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className={`${CAMPO} pl-9`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={ROTULO}>Vencimento</label>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className={CAMPO}
                />
              </div>
            </div>

            {ehReceber ? (
              <div className="space-y-1.5">
                <label className={ROTULO}>Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={CAMPO}
                >
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {/*
                  Nome livre ao lado do seletor, e não no lugar dele: quem paga
                  nem sempre é cliente da agência — venda avulsa, reembolso,
                  rendimento. Sem o campo, essas linhas entrariam sem dono.
                */}
                <input
                  type="text"
                  value={contraparte}
                  onChange={(e) => setContraparte(e.target.value)}
                  placeholder="Ou quem paga, quando não é um cliente"
                  className={CAMPO}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className={ROTULO}>Fornecedor</label>
                <input
                  type="text"
                  value={contraparte}
                  onChange={(e) => setContraparte(e.target.value)}
                  placeholder="Para quem vai o pagamento"
                  className={CAMPO}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className={ROTULO}>Categoria</label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder={ehReceber ? 'Social media, tráfego, projeto' : 'Ferramentas, equipe, impostos'}
                className={CAMPO}
              />
              {/* Texto livre, e não lista fechada: toda agência categoriza do
                  jeito dela, e uma lista nossa obrigaria a traduzir. O
                  relatório agrupa pelo que foi escrito. */}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={ROTULO}>{ehReceber ? 'Recebido em' : 'Pago em'}</label>
                  <input
                    type="date"
                    value={liquidadoEm}
                    onChange={(e) => setLiquidadoEm(e.target.value)}
                    className={CAMPO}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={ROTULO}>Caixa</label>
                  <select
                    value={caixaId}
                    onChange={(e) => setCaixaId(e.target.value)}
                    disabled={!liquidadoEm}
                    className={`${CAMPO} disabled:opacity-50`}
                  >
                    <option value="">Sem caixa</option>
                    {caixas
                      .filter((c) => !c.arquivado || c.id === caixaId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Em branco, a conta fica <strong>em aberto</strong>. A data preenchida é o dia em
                que o dinheiro andou — é ela que o relatório de caixa soma, e não o vencimento.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={ROTULO}>Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className={CAMPO}
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center gap-2">
            {lancamento && aoExcluir && (
              <Button
                variant="ghost"
                onClick={() =>
                  pedir({
                    titulo: 'Excluir este lançamento?',
                    descricao:
                      'Ele some do mês, dos vencidos e do saldo do caixa. O histórico do que já foi pago some junto — não há lixeira para lançamento.',
                    rotuloConfirmar: 'Excluir',
                    destrutivo: true,
                    aoConfirmar: async () => {
                      await aoExcluir(lancamento.id);
                      aoFechar();
                    },
                  })
                }
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="outline" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando || !descricao.trim()}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sem esta linha o `pedir` não desenha nada: o clique em Excluir deixa
          de fazer efeito, sem erro e sem pista. */}
      {dialogo}
    </>
  );
};

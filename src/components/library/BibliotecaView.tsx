import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Image as ImageIcon,
  Film,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react';
import { usePostfy } from '../../context/PostfyContext';
import { Button } from '../ui/button';
import { MediaUploader } from '../common/MediaUploader';
import { safeDateFormat } from '../../lib/utils';
import { ApiError } from '../../lib/api';
import {
  listarArquivos,
  excluirArquivo,
  levantarUsos,
  nomeDoArquivo,
  tipoDoArquivo,
  tamanhoLegivel,
  type ArquivoDaBiblioteca,
  type UsoDoArquivo,
} from '../../lib/biblioteca';

const ICONE = {
  image: ImageIcon,
  video: Film,
  documento: FileText,
} as const;

type Tipo = 'todos' | 'image' | 'video' | 'documento';

/** A pasta "sem cliente": arquivo que ninguém aponta, ou sem cliente no uso. */
const SEM_CLIENTE = '__sem_cliente__';

/**
 * A Biblioteca: tudo que a agência tem no R2, com pasta por cliente.
 *
 * **A pasta é derivada do uso, não da chave do arquivo.** A chave é
 * `workspaceId/timestamp-uuid-nome` — plana, sem cliente. Pôr o cliente na
 * chave resolveria os arquivos novos e deixaria órfãos para sempre os que já
 * estão lá; e o mesmo arquivo pode servir a dois clientes, que uma pasta
 * física não representa. Derivar do uso resolve os dois casos e, de graça,
 * responde a pergunta que importa antes de excluir: *em quantos conteúdos
 * esta mídia está?*
 *
 * O custo assumido é que arquivo enviado e nunca usado cai em "Sem cliente".
 * É o certo: ele realmente não é de ninguém ainda.
 */
export const BibliotecaView: React.FC = () => {
  const { currentWorkspace, clients, setClientFilter, setActiveTab } = usePostfy();

  const [arquivos, setArquivos] = useState<ArquivoDaBiblioteca[]>([]);
  const [usos, setUsos] = useState<Map<string, UsoDoArquivo>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semArmazenamento, setSemArmazenamento] = useState(false);

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [pasta, setPasta] = useState<string>('todos');

  const [copiado, setCopiado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  const carregar = async () => {
    if (!currentWorkspace?.id) return;
    setCarregando(true);
    setErro(null);
    setSemArmazenamento(false);
    try {
      const [lista, mapa] = await Promise.all([
        listarArquivos(currentWorkspace.id),
        levantarUsos(),
      ]);
      setArquivos(lista);
      setUsos(mapa);
    } catch (e) {
      // Armazenamento não configurado é diferente de biblioteca vazia, e a
      // tela precisa dizer qual dos dois é — mostrar "nenhum arquivo" para um
      // problema de configuração é a armadilha 9.
      if (e instanceof ApiError && e.code === 'STORAGE_NOT_CONFIGURED') {
        setSemArmazenamento(true);
      } else {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar a biblioteca.');
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  /** Quantos arquivos cada pasta tem. É o que o contador da lateral mostra. */
  const porPasta = useMemo(() => {
    const conta = new Map<string, number>();
    for (const arquivo of arquivos) {
      const uso = arquivo.url ? usos.get(arquivo.url) : undefined;
      const donos = uso?.clientIds.length ? uso.clientIds : [SEM_CLIENTE];
      for (const dono of donos) conta.set(dono, (conta.get(dono) || 0) + 1);
    }
    return conta;
  }, [arquivos, usos]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return arquivos.filter((arquivo) => {
      if (tipo !== 'todos' && tipoDoArquivo(arquivo.key) !== tipo) return false;
      if (termo && !nomeDoArquivo(arquivo.key).toLowerCase().includes(termo)) return false;

      if (pasta !== 'todos') {
        const uso = arquivo.url ? usos.get(arquivo.url) : undefined;
        const donos = uso?.clientIds || [];
        if (pasta === SEM_CLIENTE ? donos.length > 0 : !donos.includes(pasta)) return false;
      }
      return true;
    });
  }, [arquivos, usos, busca, tipo, pasta]);

  const espacoTotal = useMemo(
    () => arquivos.reduce((soma, a) => soma + a.tamanho, 0),
    [arquivos]
  );

  const copiar = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiado(url);
    setTimeout(() => setCopiado(null), 1800);
  };

  const excluir = async (chave: string) => {
    if (!currentWorkspace?.id) return;
    setApagando(chave);
    try {
      await excluirArquivo(currentWorkspace.id, chave);
      setArquivos((antes) => antes.filter((a) => a.key !== chave));
      setConfirmando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir o arquivo.');
    } finally {
      setApagando(null);
    }
  };

  const pastas = useMemo(() => {
    const comArquivo = clients
      .filter((c) => (porPasta.get(c.id) || 0) > 0)
      .map((c) => ({ id: c.id, nome: c.name, total: porPasta.get(c.id) || 0 }))
      .sort((a, b) => b.total - a.total);

    const soltos = porPasta.get(SEM_CLIENTE) || 0;
    return soltos > 0
      ? [...comArquivo, { id: SEM_CLIENTE, nome: 'Sem cliente', total: soltos }]
      : comArquivo;
  }, [clients, porPasta]);

  return (
    /**
     * **A raiz precisa rolar sozinha.**
     *
     * O `<main>` do `App.tsx` é `flex-1 min-h-0 overflow-hidden`: ele dá a
     * altura e **corta** o que passa dela. Quem rola é cada tela, e esta era a
     * única sem `overflow-y-auto` — o acervo passava da dobra e simplesmente
     * não havia como chegar nele, sem barra, sem erro, sem pista.
     *
     * Só aparece quando o conteúdo passa da altura da janela, então no
     * desktop de quem escreveu, com poucos arquivos, ela parecia certa.
     */
    <div className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Biblioteca
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {carregando
              ? 'Lendo o armazenamento…'
              : `${arquivos.length} ${arquivos.length === 1 ? 'arquivo' : 'arquivos'} · ${tamanhoLegivel(espacoTotal)}`}
          </p>
        </div>

        <Button variant="secondary" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {semArmazenamento && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-2">
          <span className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            Armazenamento de arquivos não configurado
          </span>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
            A biblioteca lê o balde do Cloudflare R2, e ele ainda não tem credenciais neste
            ambiente. Defina{' '}
            <code className="font-mono">R2_ACCOUNT_ID</code>,{' '}
            <code className="font-mono">R2_ACCESS_KEY_ID</code>,{' '}
            <code className="font-mono">R2_SECRET_ACCESS_KEY</code> e{' '}
            <code className="font-mono">R2_BUCKET</code> na Vercel. A aba{' '}
            <strong>Configurações → Integrações</strong> mostra o que falta, lendo do servidor.
          </p>
        </div>
      )}

      {erro && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{erro}</p>
        </div>
      )}

      {/* Enviar daqui, e não só de dentro de um conteúdo: arte aprovada muitas
          vezes chega antes de existir o post que vai usá-la. O arquivo cai em
          "Sem cliente" até alguém apontar para ele, que é a verdade. */}
      {!semArmazenamento && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <MediaUploader
            mediaUrls={[]}
            onChange={() => void carregar()}
            maxFiles={20}
            label="Enviar para a biblioteca"
            helperText="O arquivo fica disponível para qualquer conteúdo desta agência."
          />
        </div>
      )}

      {!semArmazenamento && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Pastas. Lateral no desktop, faixa rolável no celular. */}
          <aside className="md:w-56 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 md:sticky md:top-4">
              <span className="block px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pastas
              </span>

              <div className="flex md:flex-col gap-1 overflow-x-auto">
                <ItemDePasta
                  ativo={pasta === 'todos'}
                  nome="Todos os arquivos"
                  total={arquivos.length}
                  aoClicar={() => setPasta('todos')}
                />
                {pastas.map((p) => (
                  <ItemDePasta
                    key={p.id}
                    ativo={pasta === p.id}
                    nome={p.nome}
                    total={p.total}
                    aoClicar={() => setPasta(p.id)}
                  />
                ))}
              </div>

              {pastas.length === 0 && !carregando && (
                <p className="px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
                  A pasta de cada cliente aparece quando algum conteúdo dele usa um arquivo
                  desta biblioteca.
                </p>
              )}
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="busca-biblioteca"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome do arquivo..."
                  className="w-full h-8 pl-9 pr-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {(['todos', 'image', 'video', 'documento'] as Tipo[]).map((t) => (
                <Button
                  key={t}
                  variant={tipo === t ? 'soft' : 'ghost'}
                  onClick={() => setTipo(t)}
                >
                  {t === 'todos'
                    ? 'Tudo'
                    : t === 'image'
                      ? 'Imagens'
                      : t === 'video'
                        ? 'Vídeos'
                        : 'Documentos'}
                </Button>
              ))}
            </div>

            {carregando ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
              </div>
            ) : erro ? (
              /* Falhou a leitura: a grade não diz nada. O vazio abaixo
                 afirmaria "nenhum arquivo", que é diferente de "não consegui
                 olhar" — e é justamente a diferença que faz a pessoa concluir
                 que perdeu o acervo. O aviso vermelho lá em cima é a resposta. */
              null
            ) : visiveis.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
                <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-3">
                  {arquivos.length === 0
                    ? 'Nenhum arquivo nesta agência'
                    : 'Nenhum arquivo com esse filtro'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {arquivos.length === 0
                    ? 'Envie uma arte acima, ou anexe mídia a um conteúdo — ela aparece aqui.'
                    : 'Tente outro tipo, outra pasta, ou limpe a busca.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {visiveis.map((arquivo) => (
                  <Cartao
                    key={arquivo.key}
                    arquivo={arquivo}
                    uso={arquivo.url ? usos.get(arquivo.url) : undefined}
                    clientes={clients}
                    copiado={copiado === arquivo.url}
                    confirmando={confirmando === arquivo.key}
                    apagando={apagando === arquivo.key}
                    aoCopiar={() => arquivo.url && void copiar(arquivo.url)}
                    aoPedirExclusao={() => setConfirmando(arquivo.key)}
                    aoDesistir={() => setConfirmando(null)}
                    aoExcluir={() => void excluir(arquivo.key)}
                    aoVerConteudo={(clientId) => {
                      setClientFilter(clientId);
                      setActiveTab('producao');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Item de pasta: `<button>` à mão porque tem estado "selecionada" e ocupa a
 * largura da lateral — é o papel "item selecionável" que a guarda de
 * `tests/botoes.test.ts` nomeia, e sai quando a casca virar `SidebarMenuButton`.
 */
const ItemDePasta: React.FC<{
  ativo: boolean;
  nome: string;
  total: number;
  aoClicar: () => void;
}> = ({ ativo, nome, total, aoClicar }) => (
  <button
    type="button"
    onClick={aoClicar}
    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
      ativo
        ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
    }`}
  >
    <span className="truncate">{nome}</span>
    <span className="font-mono text-[10px] text-slate-400 shrink-0">{total}</span>
  </button>
);

const Cartao: React.FC<{
  arquivo: ArquivoDaBiblioteca;
  uso?: UsoDoArquivo;
  clientes: { id: string; name: string }[];
  copiado: boolean;
  confirmando: boolean;
  apagando: boolean;
  aoCopiar: () => void;
  aoPedirExclusao: () => void;
  aoDesistir: () => void;
  aoExcluir: () => void;
  aoVerConteudo: (clientId: string) => void;
}> = ({
  arquivo,
  uso,
  clientes,
  copiado,
  confirmando,
  apagando,
  aoCopiar,
  aoPedirExclusao,
  aoDesistir,
  aoExcluir,
  aoVerConteudo,
}) => {
  const tipo = tipoDoArquivo(arquivo.key);
  const Icone = ICONE[tipo];
  const emUso = (uso?.jobs.length || 0) + (uso?.outros || 0);
  const dono = uso?.clientIds[0]
    ? clientes.find((c) => c.id === uso.clientIds[0])
    : undefined;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col group">
      <div className="aspect-square bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center relative overflow-hidden">
        {tipo === 'image' && arquivo.url ? (
          <img
            src={arquivo.url}
            alt={nomeDoArquivo(arquivo.key)}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <Icone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        )}

        {/* O número de usos fica na mídia, e não escondido no detalhe: é o que
            decide se dá para excluir. Zero é informação tanto quanto três. */}
        <span
          className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            emUso > 0
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900/70 text-white dark:bg-slate-950/80'
          }`}
          title={
            emUso > 0
              ? `Em uso em ${emUso} ${emUso === 1 ? 'lugar' : 'lugares'}`
              : 'Nenhum conteúdo aponta para este arquivo'
          }
        >
          {emUso > 0 ? `${emUso} em uso` : 'sem uso'}
        </span>
      </div>

      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="min-w-0">
          <span
            className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
            title={nomeDoArquivo(arquivo.key)}
          >
            {nomeDoArquivo(arquivo.key)}
          </span>
          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
            {tamanhoLegivel(arquivo.tamanho)}
            {arquivo.modificadoEm ? ` · ${safeDateFormat(arquivo.modificadoEm)}` : ''}
          </span>
        </div>

        {dono && (
          <button
            type="button"
            onClick={() => aoVerConteudo(dono.id)}
            className="self-start max-w-full text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-400 transition cursor-pointer truncate"
            title={`Ver o quadro de ${dono.name}`}
          >
            {dono.name}
            {(uso?.clientIds.length || 0) > 1 ? ` +${(uso!.clientIds.length) - 1}` : ''}
          </button>
        )}

        <div className="mt-auto pt-1">
          {confirmando ? (
            /* Confirmação no próprio cartão, dizendo o que está em jogo. O
               arquivo sai do R2 e não volta, e quem usa não fica sabendo —
               então o número de usos vai no texto, não num aviso genérico. */
            <div className="space-y-2">
              <p className="text-[10px] leading-snug text-rose-700 dark:text-rose-300 font-semibold">
                {emUso > 0
                  ? `Em uso em ${emUso} ${emUso === 1 ? 'lugar' : 'lugares'}. Excluir deixa a mídia quebrada lá.`
                  : 'Excluir do armazenamento? Não tem volta.'}
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="destructive"
                  onClick={aoExcluir}
                  disabled={apagando}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {apagando ? 'Excluindo…' : 'Confirmar'}
                </Button>
                <Button variant="ghost" onClick={aoDesistir} disabled={apagando}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={aoCopiar}
                disabled={!arquivo.url}
                title={arquivo.url ? 'Copiar a URL' : 'Este balde não tem URL pública'}
              >
                {copiado ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>

              {arquivo.url && (
                <Button variant="ghost" size="icon-sm" asChild title="Abrir em outra aba">
                  <a href={arquivo.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              )}

              <Button
                variant="destructive"
                size="icon-sm"
                onClick={aoPedirExclusao}
                className="ml-auto"
                title="Excluir do armazenamento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BibliotecaView;

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Coleção simples persistida no Supabase.
 *
 * Para telas cuja lista vivia num useState local e sumia no recarregamento
 * (planos do SaaS, squads). O recorte por agência é da RLS, como no resto;
 * aqui só passamos workspace_id na escrita porque a coluna é obrigatória.
 *
 * Se o banco ainda não tem nada, o valor inicial é gravado — assim a tela
 * nasce com o conteúdo padrão em vez de vazia.
 */
export const useServerCollection = <T extends { id: string }>(
  tabela: string,
  valorInicial: T[],
  workspaceId: string,
  paraLinha: (item: T, workspaceId: string) => Record<string, any>,
  daLinha: (linha: any) => T
) => {
  const [linhas, setLinhas] = useState<T[]>(valorInicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const hidratado = useRef(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelado = false;

    (async () => {
      try {
        const { data, error } = await supabase.from(tabela).select('*');
        if (error) throw new Error(error.message);
        if (cancelado) return;

        if (data && data.length > 0) {
          setLinhas(data.map(daLinha));
        } else if (valorInicial.length > 0) {
          const semear = valorInicial.map((item) => paraLinha(item, workspaceId));
          const { data: criados, error: erroSemente } = await supabase
            .from(tabela)
            .insert(semear)
            .select();
          // Falha ao semear não é bloqueante: normalmente é papel sem
          // permissão de escrita, e a tela segue exibindo o padrão.
          if (!erroSemente && criados && !cancelado) setLinhas(criados.map(daLinha));
        }
      } catch (err) {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : 'Não foi possível carregar do banco.');
        }
      } finally {
        if (!cancelado) {
          hidratado.current = true;
          setCarregando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabela, workspaceId]);

  const salvar = useCallback(
    (proximas: T[] | ((atual: T[]) => T[])) => {
      setLinhas((atual) => {
        const resultado =
          typeof proximas === 'function' ? (proximas as (a: T[]) => T[])(atual) : proximas;

        if (!hidratado.current || !workspaceId) return resultado;

        const idsAntes = new Set(atual.map((x) => x.id));
        const idsDepois = new Set(resultado.map((x) => x.id));

        const inseridos = resultado.filter((x) => !idsAntes.has(x.id));
        const removidos = atual.filter((x) => !idsDepois.has(x.id)).map((x) => x.id);
        const alterados = resultado.filter((x) => {
          const anterior = atual.find((y) => y.id === x.id);
          return anterior && JSON.stringify(anterior) !== JSON.stringify(x);
        });

        (async () => {
          try {
            if (inseridos.length) {
              const { error } = await supabase
                .from(tabela)
                .insert(inseridos.map((i) => paraLinha(i, workspaceId)));
              if (error) throw new Error(error.message);
            }
            for (const item of alterados) {
              const { error } = await supabase
                .from(tabela)
                .update(paraLinha(item, workspaceId))
                .eq('id', item.id);
              if (error) throw new Error(error.message);
            }
            if (removidos.length) {
              const { error } = await supabase.from(tabela).delete().in('id', removidos);
              if (error) throw new Error(error.message);
            }
            setErro(null);
          } catch (err) {
            setErro(err instanceof Error ? err.message : 'Não foi possível salvar no banco.');
          }
        })();

        return resultado;
      });
    },
    [tabela, workspaceId, paraLinha]
  );

  return { linhas, salvar, carregando, erro };
};

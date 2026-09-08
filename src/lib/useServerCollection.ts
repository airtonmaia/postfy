import { useCallback, useEffect, useRef, useState } from 'react';
import { dataApi, ApiError } from './api';

/**
 * Coleção simples persistida no servidor.
 *
 * Para telas que mantinham a lista num useState local e perdiam tudo no
 * recarregamento (planos do SaaS, squads). Segue o mesmo recorte por workspace
 * das demais coleções, imposto no servidor.
 *
 * Se o servidor não tiver nada guardado ainda, o valor inicial é usado e
 * enviado — assim a tela nasce com o conteúdo padrão sem ficar vazia.
 */
export const useServerCollection = <T extends { id: string }>(
  colecao: string,
  valorInicial: T[]
) => {
  const [linhas, setLinhas] = useState<T[]>(valorInicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const hidratado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const { collections } = await dataApi.fetchAll();
        if (cancelado) return;

        const remotas = (collections[colecao] || []) as T[];
        if (remotas.length > 0) {
          setLinhas(remotas);
        } else if (valorInicial.length > 0) {
          dataApi.pushCollection(colecao, valorInicial).catch(() => {});
        }
      } catch (err) {
        if (!cancelado) {
          setErro(
            err instanceof ApiError
              ? err.message
              : 'Não foi possível carregar do servidor.'
          );
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
  }, [colecao]);

  /** Atualiza o estado e agenda o envio, com debounce. */
  const salvar = useCallback(
    (proximas: T[] | ((atual: T[]) => T[])) => {
      setLinhas((atual) => {
        const resultado =
          typeof proximas === 'function' ? (proximas as (a: T[]) => T[])(atual) : proximas;

        if (hidratado.current) {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            dataApi
              .pushCollection(colecao, resultado)
              .then(() => setErro(null))
              .catch((err) =>
                setErro(
                  err instanceof ApiError ? err.message : 'Não foi possível salvar no servidor.'
                )
              );
          }, 600);
        }

        return resultado;
      });
    },
    [colecao]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { linhas, salvar, carregando, erro };
};

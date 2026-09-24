import React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

/**
 * Carrossel, a peça do shadcn com o vocabulário deste projeto.
 *
 * O canto é traduzido na entrada, como manda a seção de desenho: o que o
 * shadcn usa em controle (`rounded-md` no botão de seta) vira o
 * `rounded-full` que um botão circular pede aqui — ele é círculo de verdade,
 * que é a única exceção nomeada do vocabulário.
 *
 * **Só as peças que este produto usa entraram.** O `CarouselItem` com
 * `basis-1/3` e afins ficou de fora: aqui o carrossel mostra uma arte por
 * vez, e um `basis` solto é o tipo de valor que a regra de desenho existe
 * para recusar.
 *
 * `loop` fica **desligado** por padrão, e isso não é detalhe: numa lista de
 * páginas de carrossel, voltar ao começo sem aviso faz a pessoa perder a
 * conta de quantas já viu — e a contagem é justamente o que ela usa para
 * saber se viu tudo antes de aprovar.
 */

type ApiDoCarrossel = UseEmblaCarouselType[1];

interface ContextoDoCarrossel {
  refDoConteudo: ReturnType<typeof useEmblaCarousel>[0];
  api?: ApiDoCarrossel;
  anterior: () => void;
  proximo: () => void;
  temAnterior: boolean;
  temProximo: boolean;
  /** Em qual item o carrossel está, começando em zero. */
  atual: number;
  total: number;
}

const Contexto = React.createContext<ContextoDoCarrossel | null>(null);

export const useCarrossel = (): ContextoDoCarrossel => {
  const contexto = React.useContext(Contexto);
  if (!contexto) throw new Error('useCarrossel precisa estar dentro de <Carousel>.');
  return contexto;
};

export const Carousel: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { loop?: boolean }
> = ({ className, children, loop = false, ...props }) => {
  const [refDoConteudo, api] = useEmblaCarousel({ loop, align: 'start' });
  const [temAnterior, setTemAnterior] = React.useState(false);
  const [temProximo, setTemProximo] = React.useState(false);
  const [atual, setAtual] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  const aoMudar = React.useCallback((instancia?: ApiDoCarrossel) => {
    if (!instancia) return;
    setTemAnterior(instancia.canScrollPrev());
    setTemProximo(instancia.canScrollNext());
    setAtual(instancia.selectedScrollSnap());
    setTotal(instancia.scrollSnapList().length);
  }, []);

  React.useEffect(() => {
    if (!api) return;
    aoMudar(api);
    api.on('select', aoMudar);
    // `reInit` porque a arte chega depois: a altura do slide muda quando a
    // imagem carrega, e sem isto o carrossel fica com a medida do vazio.
    api.on('reInit', aoMudar);
    return () => {
      api.off('select', aoMudar);
      api.off('reInit', aoMudar);
    };
  }, [api, aoMudar]);

  const valor: ContextoDoCarrossel = {
    refDoConteudo,
    api,
    anterior: () => api?.scrollPrev(),
    proximo: () => api?.scrollNext(),
    temAnterior,
    temProximo,
    atual,
    total,
  };

  return (
    <Contexto.Provider value={valor}>
      <div className={cn('relative', className)} role="region" aria-roledescription="carrossel" {...props}>
        {children}
      </div>
    </Contexto.Provider>
  );
};

export const CarouselContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  const { refDoConteudo } = useCarrossel();

  return (
    <div ref={refDoConteudo} className="overflow-hidden">
      <div className={cn('flex', className)} {...props}>
        {children}
      </div>
    </div>
  );
};

export const CarouselItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    role="group"
    aria-roledescription="slide"
    // `min-w-0` porque um filho de flex não encolhe abaixo do conteúdo por
    // padrão — sem ele a arte empurra a vizinha e o arraste some.
    className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
    {...props}
  />
);

/**
 * As setas.
 *
 * Desligadas na ponta em vez de escondidas: um controle que some faz a
 * pessoa duvidar de onde ele estava, e aqui ele é a pista de que há mais
 * páginas.
 */
const SetaDoCarrossel: React.FC<{ lado: 'anterior' | 'proximo' }> = ({ lado }) => {
  const { anterior, proximo, temAnterior, temProximo } = useCarrossel();
  const ehAnterior = lado === 'anterior';

  return (
    <Button
      type="button"
      size="icon-sm"
      onClick={(e) => {
        // A arte costuma ser clicável por baixo: sem isto, navegar também
        // dispararia o que estiver embaixo.
        e.stopPropagation();
        ehAnterior ? anterior() : proximo();
      }}
      disabled={ehAnterior ? !temAnterior : !temProximo}
      aria-label={ehAnterior ? 'Página anterior' : 'Próxima página'}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/55 hover:bg-black/75 text-white disabled:opacity-0 transition',
        ehAnterior ? 'left-2' : 'right-2'
      )}
    >
      {ehAnterior ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </Button>
  );
};

export const CarouselPrevious: React.FC = () => <SetaDoCarrossel lado="anterior" />;
export const CarouselNext: React.FC = () => <SetaDoCarrossel lado="proximo" />;

/**
 * As bolinhas, que aqui não são enfeite.
 *
 * Elas dizem **quantas páginas existem** — e é isso que o cliente usa para
 * saber se viu a peça inteira antes de aprovar. Um carrossel sem contagem
 * aprova-se na primeira página.
 */
export const CarouselDots: React.FC = () => {
  const { api, atual, total } = useCarrossel();
  if (total <= 1) return null;

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            api?.scrollTo(i);
          }}
          aria-label={`Ir para a página ${i + 1}`}
          aria-current={i === atual}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-all',
            i === atual ? 'bg-white w-4' : 'bg-white/55 hover:bg-white/80'
          )}
        />
      ))}
    </div>
  );
};

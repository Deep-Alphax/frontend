import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * QueryClient dos testes — espelha os defaults de `Providers.tsx`.
 *
 * O `staleTime: 60_000` é DE PROPÓSITO: é ele que faz o cache servir o estado
 * anterior a um PATCH quando a chave não é invalidada. Zerar aqui esconderia
 * exatamente a classe de bug que os testes de KOL cobrem (edição salva que
 * "some" ao reabrir o modal).
 *
 * Só `retry` muda: em produção é 1, aqui é `false`, senão cada caminho de erro
 * espera o backoff do React Query e o teste fica lento sem ganhar cobertura.
 */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

/** Render dentro de um QueryClientProvider isolado por teste. */
export function renderWithQuery(
  ui: ReactElement,
  client: QueryClient = makeTestQueryClient(),
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper }), client };
}

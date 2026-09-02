// Setup global do Vitest (jsdom). Adiciona os matchers do jest-dom
// (toBeInTheDocument, etc.) para os testes de componente.
import "@testing-library/jest-dom";

/**
 * jsdom não implementa IntersectionObserver, e as listas do projeto (índice de
 * KOLs, preset do admin, feed do Radar) usam uma sentinela para paginar. Stub
 * inerte: nunca dispara, então o teste controla a paginação chamando a API.
 */
if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

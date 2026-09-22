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

/**
 * jsdom também não implementa ResizeObserver, usado pela esteira da Mentoria
 * para decidir se as setas de rolagem ficam habilitadas. Stub inerte pelo mesmo
 * motivo do anterior: em jsdom `clientWidth`/`scrollWidth` são sempre 0, então
 * um observer de verdade não teria nada de real para medir.
 */
/**
 * O Select (Radix) usa pointer capture e `scrollIntoView` ao abrir/navegar o
 * painel — nenhum dos dois existe no jsdom. Sem os stubs, abrir o dropdown num
 * teste lança "hasPointerCapture is not a function".
 */
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

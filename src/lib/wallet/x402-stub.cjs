/**
 * Stub CommonJS para os módulos opcionais `@x402/*` (pagamento x402) que o
 * `@coinbase/cdp-sdk` — puxado pelo conector "Base Account" do wagmi/AppKit —
 * importa estática e dinamicamente. Esses pacotes NÃO estão instalados e o app
 * NÃO usa x402; o código que os consome (signX402Payment) nunca roda no fluxo de
 * conexão de carteira.
 *
 * Por que CommonJS + Proxy: um módulo ESM vazio falha na checagem ESTÁTICA de
 * exports do Turbopack (ex.: `import { toClientEvmSigner } from "@x402/evm"`).
 * Um módulo CJS tem exports dinâmicos → o bundler aceita qualquer import nomeado,
 * e o Proxy devolve um no-op para qualquer propriedade. `__esModule` habilita a
 * interop ESM; `then` fica undefined para o namespace não virar "thenable".
 */
const noop = function () {};

module.exports = new Proxy(function () {}, {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "then") return undefined;
    if (prop === "default") return module.exports;
    return noop;
  },
});

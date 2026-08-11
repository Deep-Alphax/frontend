/**
 * Sanitiza um destino de redirect pós-login: só aceita caminhos INTERNOS.
 * Bloqueia absolute URLs (`https://…`, `//host`, `/\host`) e esquemas
 * (`javascript:`) para evitar open redirect. Fallback: `/`.
 *
 * Pura (sem imports) → testável em isolamento.
 */
export function safeRedirect(path: string | null | undefined): string {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\")
  ) {
    return "/";
  }
  return path;
}

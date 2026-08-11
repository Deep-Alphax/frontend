"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

interface TurnstileFieldProps {
  /** Recebe o token quando resolvido; `undefined` ao expirar/errar. */
  onToken: (token?: string) => void;
}

/**
 * Widget anti-bot do Cloudflare Turnstile. Só renderiza quando há site key
 * configurada (NEXT_PUBLIC_TURNSTILE_SITE_KEY). `interaction-only` mantém o
 * widget invisível a menos que a Cloudflare exija interação — casando com o
 * design (sem captcha visível no fluxo feliz).
 */
export function TurnstileField({ onToken }: TurnstileFieldProps) {
  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <Turnstile
      siteKey={TURNSTILE_SITE_KEY}
      onSuccess={onToken}
      onExpire={() => onToken(undefined)}
      onError={() => onToken(undefined)}
      options={{ appearance: "interaction-only", theme: "dark" }}
    />
  );
}

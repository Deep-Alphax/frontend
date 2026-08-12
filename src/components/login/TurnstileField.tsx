"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

interface TurnstileFieldProps {
  /** Recebe o token quando resolvido; `undefined` ao expirar/errar. */
  onToken: (token?: string) => void;
}

/**
 * Widget anti-bot do Cloudflare Turnstile. Só renderiza quando há site key
 * configurada (NEXT_PUBLIC_TURNSTILE_SITE_KEY).
 *
 * - `appearance: "always"` → widget SEMPRE visível (não só quando a Cloudflare
 *   exige interação).
 * - `size: "flexible"` → o widget se estica p/ acompanhar a largura do container
 *   (é o modo responsivo do Turnstile; mín. 300px). O wrapper `w-full` garante
 *   que ele ocupe toda a largura disponível do form.
 */
export function TurnstileField({ onToken }: TurnstileFieldProps) {
  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="w-full">
      <Turnstile
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={onToken}
        onExpire={() => onToken(undefined)}
        onError={() => onToken(undefined)}
        options={{ appearance: "always", size: "flexible", theme: "dark" }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

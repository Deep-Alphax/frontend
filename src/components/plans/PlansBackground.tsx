"use client";

import { useEffect, useRef, useState } from "react";

import { createLightRays, FALLBACK_BACKGROUND } from "@/components/plans/lightRays";

/*
 * Camada de luz da tela de planos (`background-planos.html`).
 *
 * Fica `fixed` cobrindo a viewport, atrás de todo o conteúdo (z-0). É a MESMA
 * camada que a borda dos cards e o badge revelam por recorte — por isso ela é
 * fixa e única: o gradiente continua contínuo de um elemento para o outro, sem
 * um segundo contexto WebGL por peça.
 *
 * Sem WebGL, cai num radial-gradient estático equivalente.
 */
export function PlansBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rays = createLightRays(canvas);
    if (!rays) {
      setFailed(true);
      return;
    }
    return () => rays.destroy();
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      // O contexto é criado com `alpha:false`, então um canvas sem desenho fica
      // preto opaco: no fallback ele some e o gradiente vai no contêiner.
      style={failed ? { background: FALLBACK_BACKGROUND } : undefined}
    >
      <canvas ref={canvasRef} className="block size-full" hidden={failed} />
      {/* Grão: mata o banding em telas de 8 bits. Estático com reduced-motion. */}
      <div className="plans-grain absolute inset-[-50%] opacity-[0.04] motion-safe:animate-plans-grain" />
    </div>
  );
}

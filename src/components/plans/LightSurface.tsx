"use client";

import { useEffect, useRef, useState } from "react";

import {
  createLightRays,
  type Palette,
  type LightRaysOptions,
} from "@/components/plans/lightRays";
import { cn } from "@/lib/cn";

interface LightSurfaceProps {
  /** DEVE ser uma referência estável (const de módulo) — entra nas deps do efeito. */
  colors: Palette;
  className?: string;
  /** Fator de resolução. Ver `LightRaysOptions.resolutionScale`. */
  resolutionScale?: number;
  /** Cor sólida quando não há WebGL — normalmente `colors.ceil` ou `colors.base`. */
  fallbackColor: string;
  config?: LightRaysOptions["config"];
}

/**
 * Instância do shader dimensionada pela própria caixa CSS. É o que preenche o
 * anel da borda e o badge do card: cada peça vê o gradiente inteiro, em vez de
 * uma janela para a camada da página (onde, na altura dos cards, a luz é quase
 * a cor base).
 *
 * Decorativo e não-interativo: sem ponteiro, meia resolução por padrão.
 */
export function LightSurface({
  colors,
  className,
  resolutionScale = 0.5,
  fallbackColor,
  config,
}: LightSurfaceProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rays = createLightRays(canvas, {
      colors,
      config,
      sizeTo: "element",
      resolutionScale,
    });
    if (!rays) {
      setFailed(true);
      return;
    }
    return () => rays.destroy();
  }, [colors, config, resolutionScale]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block", className)}
      style={failed ? { background: fallbackColor } : undefined}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import {
  createStrokeLight,
  type StrokePalette,
} from "@/components/plans/strokeField";

interface StrokeLightProps {
  /** DEVE ser referência estável (const de módulo) — entra nas deps do efeito. */
  palette: StrokePalette;
}

/**
 * Contorno vivo do card. O canvas cobre a border box inteira; quem recorta os
 * 2px é a máscara do elemento pai (ver `PlanCard`). Sem WebGL2 o canvas some e
 * fica só a borda sólida que o card já tem por baixo.
 */
export function StrokeLight({ palette }: StrokeLightProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const light = createStrokeLight(canvas, { palette });
    if (!light) {
      setFailed(true);
      return;
    }
    return () => light.destroy();
  }, [palette]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      hidden={failed}
      className="absolute inset-0 block size-full"
    />
  );
}

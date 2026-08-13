"use client";

import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

/** URL da cena do Spline (animação de "sincronizando"), feita/publicada pelo usuário. */
export const SPLINE_SYNC_URL = "https://prod.spline.design/XVqh98dFrzr1YCLD/scene.splinecode";

/**
 * A câmera da cena é fixa (setZoom() é no-op), então "afastamos" por código:
 * encolhemos os objetos da cena (scale) para a logo caber no quadrado sem cortar.
 *   < 1  → menor (mais margem)   ·   1 = original   ·   > 1 = maior
 * Ajuste fino só neste número.
 */
const SCENE_SCALE = 0.5;

/** Reduz a escala de todos os objetos da cena por um fator (reatribui p/ disparar o setter). */
function fitScene(app: Application) {
  const objects = app.getAllObjects();
  // Log de diagnóstico: nomes dos objetos (ajuda a mirar só o grupo-raiz se necessário).
  console.log(
    "[spline] objetos:",
    objects.map((o) => o.name),
  );
  for (const o of objects) {
    o.scale = { x: o.scale.x * SCENE_SCALE, y: o.scale.y * SCENE_SCALE, z: o.scale.z * SCENE_SCALE };
  }
}

/**
 * Wrapper fino do runtime do Spline. Importado via `next/dynamic` ({ ssr: false })
 * → o runtime (~1MB) vira um chunk separado, baixado só quando a cena precisa
 * aparecer, e nunca roda no SSR. Preenche 100% do container (o pai define o tamanho).
 */
export default function SplineScene() {
  return <Spline scene={SPLINE_SYNC_URL} onLoad={fitScene} style={{ width: "100%", height: "100%" }} />;
}

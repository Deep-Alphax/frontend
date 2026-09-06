/*
 * Luz viva no contorno dos cards de plano — WebGL2, sem dependência.
 *
 * O alvo veio de medir o render do Figma, não de chutar: amostrei 54 pontos
 * dando a volta no card Pro e o contorno é UM matiz só (principal-9) modulado em
 * intensidade entre ~0,37 e 1,0, com quedas SUAVES e manchas em posições
 * IRREGULARES (nem tracejado, nem gradiente angular).
 *
 * A tentativa anterior renderizava um quadro 2D e recortava a borda dele — e a
 * borda de um quadro é justamente a parte morta (medido: 7/255 de variação
 * contra 23/255 no miolo). Aqui o ruído é função da POSIÇÃO NO PERÍMETRO: cada
 * pixel do anel recebe variação, e as manchas correm pela borda.
 *
 * O ângulo entra como ponto sobre um círculo (`cos`/`sin`), então o ruído é
 * periódico por construção — não existe emenda onde a volta fecha.
 */

export interface StrokePalette {
  /** Contorno "apagado" — o piso da modulação. */
  dim: string;
  /** Contorno aceso — o teto. */
  bright: string;
}

/** Medidos no render do Figma: piso ≈ 0,37 do topo no Pro, ≈ 0,57 no Free. */
export const FREE_STROKE: StrokePalette = {
  dim: "#454752",
  bright: "#7a7d8b", // gray-9
};

export const PRO_STROKE: StrokePalette = {
  dim: "#5a4a0a", // principal-6
  bright: "#f9d240", // principal-9
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uDim;
uniform vec3  uBright;
uniform float uScale;   // quantas manchas cabem na volta
uniform float uDrift;   // velocidade com que elas correm pela borda
uniform float uMorph;   // velocidade com que mudam de forma
uniform float uSoft;    // largura da transição (o "blur" das manchas)

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;

  // Normaliza para a caixa antes do atan: num retângulo isso deixa o parâmetro
  // quase uniforme na volta (sem comprimir tudo nos cantos).
  vec2 q = uv * 2.0 - 1.0;
  float theta = atan(q.y, q.x) + uTime * uDrift;

  // Ponto sobre um círculo => periódico em theta, sem emenda.
  vec2 p = vec2(cos(theta), sin(theta)) * uScale + vec2(0.0, uTime * uMorph);

  float n = fbm(p);
  // Duas escalas: a segunda quebra a regularidade da primeira.
  n = n * 0.68 + fbm(p * 2.7 + vec2(11.3, -4.1)) * 0.32;

  // smoothstep largo = transição macia (o "blur" das manchas).
  float k = smoothstep(0.5 - uSoft, 0.5 + uSoft, n);

  fragColor = vec4(mix(uDim, uBright, k), 1.0);
}`;

export interface StrokeLightOptions {
  palette: StrokePalette;
  scale?: number;
  drift?: number;
  morph?: number;
  soft?: number;
}

export interface StrokeLightHandle {
  destroy: () => void;
}

const DEFAULTS = {
  scale: 2.6,
  drift: 0.3,
  morph: 0.17,
  soft: 0.26,
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    console.error(
      `[strokeField] ${kind}: ${gl.getShaderInfoLog(shader) ?? "(sem log)"}`,
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Liga a luz no canvas, dimensionada pela caixa CSS dele. Devolve `null` sem
 * WebGL2 — aí o chamador pinta o contorno com a cor `bright` e pronto.
 *
 * O loop para com a aba oculta e, com `prefers-reduced-motion`, desenha um único
 * quadro (contorno com as manchas paradas, sem sumir).
 */
export function createStrokeLight(
  canvas: HTMLCanvasElement,
  options: StrokeLightOptions,
): StrokeLightHandle | null {
  const cfg = { ...DEFAULTS, ...options };
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(
      `[strokeField] link: ${gl.getProgramInfoLog(prog) ?? "(sem log)"}`,
    );
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform3f(U("uDim"), ...hexToRgb(cfg.palette.dim));
  gl.uniform3f(U("uBright"), ...hexToRgb(cfg.palette.bright));
  gl.uniform1f(U("uScale"), cfg.scale);
  gl.uniform1f(U("uDrift"), cfg.drift);
  gl.uniform1f(U("uMorph"), cfg.morph);
  gl.uniform1f(U("uSoft"), cfg.soft);
  const uRes = U("uRes");
  const uTime = U("uTime");

  // O anel é uma faixa de 2px: meia resolução é imperceptível e corta o custo.
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75) * 0.5;
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  const start = performance.now();
  let running = true;
  let disposed = false;

  const draw = (t: number) => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now: number) => {
    if (!running || disposed) return;
    draw((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  };

  const onResize = () => {
    resize();
    if (reduced) draw(0);
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(canvas);

  const onVisibility = () => {
    running = !document.hidden;
    if (running && !disposed) raf = requestAnimationFrame(frame);
  };

  if (reduced) {
    draw(0);
  } else {
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
  }

  return {
    destroy() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (!reduced) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      // Sem `loseContext`: `getContext` devolve o mesmo contexto para um canvas,
      // então perdê-lo quebraria a remontagem (o StrictMode faz isso em dev).
    },
  };
}

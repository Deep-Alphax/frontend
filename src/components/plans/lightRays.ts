/*
 * Raios de luz azuis — WebGL, sem dependência.
 *
 * Porte de `background-planos.html`: shader, COLORS e CONFIG são os do arquivo
 * original, verbatim. O que mudou é só o entorno — aqui a coisa toda vive num
 * `createLightRays(canvas)` que devolve um `destroy()`, para o React conseguir
 * desmontar sem vazar rAF, listeners ou o contexto WebGL.
 *
 * A luz é somada sobre COLORS.base e satura em COLORS.ceil, então nunca estoura
 * pro branco. `base` é o gray-1 do tema, então o canvas encosta exatamente na cor
 * de fundo da página.
 */

export interface Palette {
  /** Fundo sólido: o ponto mais escuro. */
  base: string;
  /** Teto da luz: o ponto mais claro para exatamente aqui. */
  ceil: string;
  mass: string;
  lobe: string;
  body: string;
  core: string;
  ray: string;
}

/** Paleta do fundo da página — a do `background-planos.html`, verbatim. */
export const PAGE_COLORS: Palette = {
  base: "#111217", // = --color-gray-1
  ceil: "#619ee6",
  mass: "#375c85", // massa principal
  lobe: "#2e4f75", // lóbulo da direita
  body: "#4d7eb4", // corpo azul
  core: "#619ee6", // núcleo
  ray: "#619ee6", // feixes de luz
};

/*
 * Paletas das peças do card. Mesma luz, dois climas: o Free herda o azul da
 * página e o Pro vira a versão dourada (escala `principal` do DS), para o card
 * não perder a identidade que ele tem no Figma.
 *
 * O `base` de cada um é a cor que amostrei do render do Figma para a superfície
 * do badge — assim o estado "sem luz" bate com o design.
 */
export const FREE_COLORS: Palette = {
  base: "#21222b", // --color-gray-3
  ceil: "#93cdff", // --color-secundaria-11
  mass: "#375c85",
  lobe: "#2e4f75",
  body: "#4d7eb4",
  core: "#619ee6",
  ray: "#93cdff",
};

export const PRO_COLORS: Palette = {
  base: "#1e1b11", // --color-principal-2
  ceil: "#ffdc4f", // --color-principal-10
  mass: "#5a4a0a", // --color-principal-6
  lobe: "#4b3c02", // --color-principal-5
  body: "#8a7427", // --color-principal-8
  core: "#f1c600", // --color-principal-11
  ray: "#f9d240", // --color-principal-9
};

/** Todos os knobs são 0–100 (exceto `angle`, em graus), como no arquivo original. */
export type LightConfig = Record<
  | "amount"
  | "scale"
  | "mix"
  | "angle"
  | "phase"
  | "speed"
  | "drift"
  | "breathe"
  | "exposure"
  | "blur"
  | "tilt"
  | "track"
  | "push"
  | "swirl"
  | "radius"
  | "momentum"
  | "parallax",
  number
>;

export const CONFIG: LightConfig = {
  amount: 108, // intensidade da distorção do flow field
  scale: 15, // tamanho das ondas (menor = ondas mais largas)
  mix: 42, // 0 = fluxo no quadro todo · 100 = concentrado no ponteiro
  angle: 360, // variação de direção
  phase: 19, // deslocamento inicial do padrão
  speed: 17, // velocidade do fluxo
  drift: 52, // vai e volta lateral do quadro inteiro
  breathe: 100, // deriva própria das manchas e dos feixes
  exposure: 65, // intensidade geral da luz — abaixe para escurecer sem mudar a cor
  blur: 50, // raio do desfoque gaussiano
  tilt: 132, // desfoque cresce longe da faixa de foco
  track: 100, // o quanto o ponteiro é levado em conta
  push: 46, // empurra a luz pra longe do cursor
  swirl: 52, // redemoinho em volta dele
  radius: 85, // alcance da interação
  momentum: 88, // inércia (alto = escorrega depois que você para)
  parallax: 34, // a massa inteira acompanha o ponteiro
};

/** Fundo estático equivalente, para quando não há WebGL. */
export const FALLBACK_BACKGROUND =
  "radial-gradient(110% 80% at 36% -10%, #9cccfe 0%, #5090db 14%, #375c85 34%, #1b2430 62%, #111217 100%)";

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform vec2  uVel;
uniform vec3  uBase, uCeil, uMass, uLobe, uBody, uCore, uRay;
uniform float uAmount, uScale, uMix, uAngle, uPhase, uSpeed, uDrift, uBreathe, uExposure;
uniform float uBlur, uTilt, uPush, uSwirl, uRadius, uParallax;

vec2 hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                 dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                 dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float blob(vec2 p, vec2 c, vec2 s, float k){
  return exp(-length((p - c) * s) * k);
}

/* luz somada sobre o fundo */
vec3 gradient(vec2 p, float t){
  p.y = 1.0 - p.y;            // luz nasce embaixo e sobe
  float b = uBreathe;
  vec3 light = vec3(0.0);

  light += uMass * blob(p, vec2(0.26 + 0.050 * sin(t * 0.31) * b,
                                0.05 + 0.030 * cos(t * 0.23) * b), vec2(0.85, 1.15), 2.5) * 1.05;
  light += uLobe * blob(p, vec2(0.72 + 0.060 * cos(t * 0.24) * b,
                               -0.02 + 0.028 * sin(t * 0.19) * b), vec2(1.60, 1.10), 4.6) * 0.85;
  light += uBody * blob(p, vec2(0.34 + 0.040 * sin(t * 0.41 + 1.7) * b,
                                0.02 + 0.022 * cos(t * 0.33) * b), vec2(1.10, 1.60), 3.8) * 0.75;
  light += uCore * blob(p, vec2(0.36 + 0.040 * sin(t * 0.50) * b,
                               -0.06 + 0.024 * cos(t * 0.47) * b), vec2(1.20, 1.90), 5.6) * 0.70;

  float fall = exp(-max(p.y, 0.0) * 2.3);
  light += uRay * exp(-pow(p.x - (0.40 + 0.045 * sin(t * 0.37) * b), 2.0) * 240.0) * fall * 0.55;
  light += uRay * exp(-pow(p.x - (0.30 + 0.035 * sin(t * 0.29 + 2.1) * b), 2.0) * 700.0) * fall * 0.28;
  light += uRay * exp(-pow(p.x - (0.52 + 0.040 * sin(t * 0.43 + 4.2) * b), 2.0) * 900.0) * fall * 0.22;

  light *= 1.0 - 0.70 * blob(p, vec2(0.20 + 0.025 * cos(t * 0.27) * b, 0.58), vec2(0.90, 1.4), 4.0);
  light *= 1.0 - 0.66 * blob(p, vec2(0.60 + 0.030 * sin(t * 0.21) * b, 0.52), vec2(1.00, 1.4), 4.6);

  light *= clamp(1.0 - 0.90 * pow(clamp((p.y - 0.24) / 0.62, 0.0, 1.0), 1.15), 0.0, 1.0);
  light *= clamp(1.0 - 0.92 * pow(clamp((p.x - 0.42) / 0.50, 0.0, 1.0), 1.10), 0.0, 1.0);

  light *= uExposure;
  return uBase + (uCeil - uBase) * (1.0 - exp(-light / uCeil));
}

vec2 flow(vec2 p, float aspect){
  float t  = uTime * uSpeed + uPhase;
  vec2  sp = vec2(p.x * aspect, p.y) * uScale;

  float n1 = fbm(sp + vec2(0.0, t * 0.38));
  float n2 = fbm(sp + vec2(4.7, -2.3) - t * 0.30);
  float a1 = (n1 * 0.5 + 0.5) * uAngle + t * 0.18;
  vec2  f1 = vec2(cos(a1), sin(a1)) * (n2 * 0.5 + 0.5);

  float n3 = fbm(sp * 2.3 + vec2(-11.3, 6.1) - vec2(t * 0.50, 0.0));
  float a2 = (n3 * 0.5 + 0.5) * uAngle * 0.5 - t * 0.24;
  vec2  f2 = vec2(cos(a2), sin(a2)) * 0.30;

  return (f1 + f2) * uAmount;
}

vec3 render(vec2 p, float t, float r){
  vec3 sum = gradient(p, t);
  if (r < 0.0008) return sum;
  const float GOLDEN = 2.399963;
  for (int i = 0; i < 10; i++){
    float f = (float(i) + 0.5) / 10.0;
    float a = GOLDEN * float(i) + t * 0.05;
    sum += gradient(p + vec2(cos(a), sin(a)) * r * sqrt(f), t);
  }
  return sum / 11.0;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  float aspect = uRes.x / uRes.y;
  float t = uTime;

  vec2 p = uv;

  p.x += sin(t * 0.21) * uDrift;
  p.y += cos(t * 0.15) * uDrift * 0.32;
  p -= (uMouse - 0.5) * uParallax;

  vec2  md   = vec2((uv.x - uMouse.x) * aspect, uv.y - uMouse.y);
  float dist = length(md);
  float infl = exp(-dist * dist / max(uRadius * uRadius, 1e-4));
  vec2  dir  = md / max(uRadius, 1e-4);   // linear: sem singularidade sob o cursor

  p += dir * infl * uPush;
  p += vec2(-dir.y, dir.x) * infl * uSwirl;
  p += uVel * infl * 0.45;

  p += flow(uv, aspect) * mix(1.0, infl, uMix);

  float band = abs(uv.y - 0.58);
  float r = uBlur * mix(0.30, 1.0, clamp(band * uTilt, 0.0, 1.0));

  vec3 col = render(p, t, r);

  vec2 v = (uv - 0.5) * vec2(aspect, 1.0);
  col *= 1.0 - 0.28 * pow(clamp(length(v) * 0.85, 0.0, 1.0), 2.2);

  float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dth - 0.5) / 255.0;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

function hexToRgb(hex: string): Float32Array {
  const n = parseInt(hex.slice(1), 16);
  return new Float32Array([
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ]);
}

function compile(
  gl: WebGLRenderingContext,
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
      `[lightRays] ${kind} shader: ${gl.getShaderInfoLog(shader) ?? "(sem log)"}`,
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export interface LightRaysHandle {
  destroy: () => void;
}

export interface LightRaysOptions {
  colors?: Palette;
  config?: Partial<LightConfig>;
  /**
   * `viewport` dimensiona pela janela (fundo da página); `element` pela caixa CSS
   * do próprio canvas, via ResizeObserver — é o modo das peças do card.
   */
  sizeTo?: "viewport" | "element";
  /**
   * Fator sobre o DPR. As peças decorativas rodam a 0,5: o gradiente é liso, a
   * perda não aparece e o custo cai 4×.
   */
  resolutionScale?: number;
  /** Reação ao ponteiro. Só faz sentido na camada que cobre a viewport. */
  interactive?: boolean;
}

/**
 * Liga o shader no canvas. Devolve `null` quando não há WebGL — o chamador cai
 * no FALLBACK_BACKGROUND.
 *
 * Custo: um contexto WebGL, um triângulo por frame, DPR limitado a 1,75. O loop
 * para quando a aba fica oculta e, com `prefers-reduced-motion`, desenha um
 * único quadro e encerra (sem rAF e sem reagir ao ponteiro).
 */
export function createLightRays(
  canvas: HTMLCanvasElement,
  options: LightRaysOptions = {},
): LightRaysHandle | null {
  const {
    colors = PAGE_COLORS,
    sizeTo = "viewport",
    resolutionScale = 1,
    interactive = sizeTo === "viewport",
  } = options;
  const cfg = { ...CONFIG, ...options.config };

  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
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
      `[lightRays] link: ${gl.getProgramInfoLog(prog) ?? "(sem log)"}`,
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

  const U = (name: string) => gl.getUniformLocation(prog, name);

  (
    [
      ["uBase", "base"],
      ["uCeil", "ceil"],
      ["uMass", "mass"],
      ["uLobe", "lobe"],
      ["uBody", "body"],
      ["uCore", "core"],
      ["uRay", "ray"],
    ] as const
  ).forEach(([uniform, key]) => {
    gl.uniform3fv(U(uniform), hexToRgb(colors[key]));
  });

  const u = {
    res: U("uRes"),
    time: U("uTime"),
    mouse: U("uMouse"),
    vel: U("uVel"),
    amount: U("uAmount"),
    scale: U("uScale"),
    mix: U("uMix"),
    angle: U("uAngle"),
    phase: U("uPhase"),
    speed: U("uSpeed"),
    drift: U("uDrift"),
    breathe: U("uBreathe"),
    exposure: U("uExposure"),
    blur: U("uBlur"),
    tilt: U("uTilt"),
    push: U("uPush"),
    swirl: U("uSwirl"),
    radius: U("uRadius"),
    parallax: U("uParallax"),
  };

  // Arrow consts (não `function`): declaração de função é içada para o topo do
  // escopo e o TS perde a narrowing de `gl` para não-nulo dentro delas.
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75) * resolutionScale;
    const boxW =
      sizeTo === "viewport" ? window.innerWidth : canvas.clientWidth;
    const boxH =
      sizeTo === "viewport" ? window.innerHeight : canvas.clientHeight;
    const w = Math.max(1, Math.floor(boxW * dpr));
    const h = Math.max(1, Math.floor(boxH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();

  const target = { x: 0.5, y: 0.5 };
  const smooth = { x: 0.5, y: 0.5 };
  const prev = { x: 0.5, y: 0.5 };
  const vel = { x: 0, y: 0 };

  const setTarget = (cx: number, cy: number) => {
    target.x = cx / window.innerWidth;
    target.y = cy / window.innerHeight;
  };
  const onPointerMove = (e: PointerEvent) => setTarget(e.clientX, e.clientY);
  const onTouchMove = (e: TouchEvent) => {
    const p = e.touches[0];
    if (p) setTarget(p.clientX, p.clientY);
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;
  let t = 0;
  let last = performance.now();
  let running = true;
  let disposed = false;

  const draw = (dt: number) => {
    const ease =
      1 - Math.pow(1 - (1 - cfg.momentum / 100) * 0.85 - 0.06, dt * 60);
    smooth.x += (target.x - smooth.x) * ease;
    smooth.y += (target.y - smooth.y) * ease;

    vel.x += (((smooth.x - prev.x) / Math.max(dt, 0.001)) * 0.12 - vel.x) * 0.18;
    vel.y += (((smooth.y - prev.y) / Math.max(dt, 0.001)) * 0.12 - vel.y) * 0.18;
    prev.x = smooth.x;
    prev.y = smooth.y;

    const trk = cfg.track / 100;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, t);
    gl.uniform2f(
      u.mouse,
      0.5 + (smooth.x - 0.5) * trk,
      0.5 + (smooth.y - 0.5) * trk,
    );
    gl.uniform2f(u.vel, vel.x * trk, vel.y * trk);
    gl.uniform1f(u.amount, (cfg.amount / 100) * 0.16);
    gl.uniform1f(u.scale, (cfg.scale / 100) * 12 + 0.4);
    gl.uniform1f(u.mix, cfg.mix / 100);
    gl.uniform1f(u.angle, (cfg.angle * Math.PI) / 180);
    gl.uniform1f(u.phase, (cfg.phase / 100) * 20);
    gl.uniform1f(u.speed, (cfg.speed / 100) * 1.6);
    gl.uniform1f(u.drift, (cfg.drift / 100) * 0.12);
    gl.uniform1f(u.breathe, cfg.breathe / 100);
    gl.uniform1f(u.exposure, cfg.exposure / 100);
    gl.uniform1f(u.blur, (cfg.blur / 100) * 0.05);
    gl.uniform1f(u.tilt, (cfg.tilt / 100) * 2.4);
    gl.uniform1f(u.push, (cfg.push / 100) * 0.1);
    gl.uniform1f(u.swirl, (cfg.swirl / 100) * 0.12);
    gl.uniform1f(u.radius, (cfg.radius / 100) * 0.55);
    gl.uniform1f(u.parallax, (cfg.parallax / 100) * 0.1);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now: number) => {
    if (!running || disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    draw(dt);
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    running = !document.hidden;
    if (running && !disposed) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  // Quem dimensiona pelo elemento acompanha a caixa dele; quem cobre a viewport
  // acompanha a janela. Nos dois casos o redesenho vem do rAF, então o observer
  // só precisa reconfigurar o buffer.
  let observer: ResizeObserver | undefined;
  // Com reduced-motion não há rAF, então o resize precisa redesenhar na mão —
  // senão o quadro único fica esticado (ou em branco) depois de mudar de tamanho.
  const onResize = () => {
    resize();
    if (reduced) draw(0.016);
  };
  const observeSize = () => {
    if (sizeTo === "viewport") {
      window.addEventListener("resize", onResize, { passive: true });
      return;
    }
    observer = new ResizeObserver(onResize);
    observer.observe(canvas);
  };
  const unobserveSize = () => {
    if (sizeTo === "viewport") window.removeEventListener("resize", onResize);
    observer?.disconnect();
  };

  if (reduced) {
    // Um quadro e ponto: sem rAF e sem reagir ao ponteiro. O tamanho ainda é
    // acompanhado, senão o quadro único fica esticado depois de um resize.
    observeSize();
    draw(0.016);
  } else {
    observeSize();
    if (interactive) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);
  }

  return {
    destroy() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      unobserveSize();
      if (!reduced) {
        if (interactive) {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("touchmove", onTouchMove);
        }
        document.removeEventListener("visibilitychange", onVisibility);
      }
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      // NÃO chamar WEBGL_lose_context aqui: `getContext` devolve sempre o mesmo
      // contexto para um canvas, então perdê-lo quebraria qualquer remontagem
      // no mesmo elemento (o StrictMode faz exatamente isso em dev, e aí os
      // shaders passam a falhar sem mensagem). O contexto é liberado junto com
      // o canvas quando o nó sai do DOM.
    },
  };
}

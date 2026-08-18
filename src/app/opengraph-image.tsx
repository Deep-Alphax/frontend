import { ImageResponse } from "next/og";

/*
 * OG image do site (preview em redes/WhatsApp/Discord). Gerada dinamicamente no
 * build via ImageResponse (satori) — sem asset estático pra manter. Card 1200×630
 * na paleta do produto (dark #111217 + acento principal #f1c600). Fonte padrão do
 * satori (texto latino) — sem custom font pra evitar fetch/erro no build.
 */
export const alt = "Deep Alpha — Wallet Analytics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#111217",
          backgroundImage:
            "radial-gradient(1100px 520px at 100% -10%, rgba(241,198,0,0.16), rgba(17,18,23,0) 60%)",
          color: "#fafafd",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px" }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#f1c600",
            }}
          />
          <div
            style={{
              fontSize: "34px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#e8e9ee",
            }}
          >
            Deep Alpha
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "94px",
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            maxWidth: "940px",
          }}
        >
          Wallet Analytics
        </div>

        {/* Tagline */}
        <div style={{ marginTop: "30px", fontSize: "36px", color: "#a0a3ad", maxWidth: "900px" }}>
          PnL real, topo × saída e feed de alpha — para carteiras Solana.
        </div>
      </div>
    ),
    { ...size },
  );
}

import { describe, it, expect } from "vitest";

import { formatBytes, toVideoEmbed } from "./video";

describe("toVideoEmbed", () => {
  it("aceita as formas de URL do YouTube e sempre monta o embed -nocookie", () => {
    const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    ]) {
      expect(toVideoEmbed(url), url).toEqual({
        provider: "youtube",
        src: expected,
      });
    }
  });

  it("aceita Vimeo pela página e pelo player", () => {
    const expected = {
      provider: "vimeo" as const,
      src: "https://player.vimeo.com/video/76979871",
    };
    expect(toVideoEmbed("https://vimeo.com/76979871")).toEqual(expected);
    expect(toVideoEmbed("https://player.vimeo.com/video/76979871")).toEqual(
      expected,
    );
  });

  it("recusa host fora da allowlist — é o que impede embutir página de terceiro", () => {
    expect(toVideoEmbed("https://evil.example.com/embed/abc")).toBeNull();
    // Host que só CONTÉM o nome de um provedor não vale.
    expect(toVideoEmbed("https://youtube.com.evil.test/watch?v=a")).toBeNull();
  });

  it("recusa esquema que não seja https", () => {
    // `javascript:` é o caso perigoso; `http:` daria mixed content no iframe.
    expect(toVideoEmbed("javascript:alert(document.cookie)")).toBeNull();
    expect(
      toVideoEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(toVideoEmbed("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("recusa id malformado em host válido", () => {
    expect(toVideoEmbed("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(toVideoEmbed("https://vimeo.com/nao-numerico")).toBeNull();
  });

  it("devolve null para vazio e para lixo", () => {
    expect(toVideoEmbed("")).toBeNull();
    expect(toVideoEmbed("   ")).toBeNull();
    expect(toVideoEmbed("nao é uma url")).toBeNull();
  });
});

describe("formatBytes", () => {
  it("escala até GB com uma casa decimal", () => {
    expect(formatBytes(450 * 1024)).toBe("450.0 KB");
    expect(formatBytes(Math.round(2.4 * 1024 * 1024))).toBe("2.4 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  it("bytes crus saem inteiros", () => {
    expect(formatBytes(900)).toBe("900 B");
  });

  it("zero e negativo viram string VAZIA, não '0 B'", () => {
    // No banco 0 significa "tamanho desconhecido": escrever "0 B" ao lado de um
    // PDF real seria informação errada na tela.
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(-1)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });
});

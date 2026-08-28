"use client";

/**
 * Redimensiona a imagem escolhida p/ 200×200 (cover) → data URL JPEG.
 * O corte no cliente é o que mantém o payload longe do teto do backend
 * (`AVATAR_MAX`, ~300KB) e a coluna do Postgres pequena.
 */
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        const s = Math.max(size / img.width, size / img.height);
        const w = img.width * s;
        const h = img.height * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = String(e.target?.result ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";

import { api } from "@/lib/api/client";
import { uploadMentorshipFile } from "@/lib/api/mentorship";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: Object.assign(actual.default, { put: vi.fn() }),
  };
});

describe("uploadMentorshipFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(axios.put).mockReset().mockResolvedValue({ status: 200 });
  });

  it("pede a URL à API e manda o arquivo DIRETO ao R2, sem o token de sessão", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        uploadUrl: "https://acc.r2.cloudflarestorage.com/bucket/key?X-Amz-Signature=x",
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        publicUrl: "https://media.deepalpha.fun/key",
      },
    });
    const file = new File(["%PDF"], "guia.pdf", { type: "application/pdf" });

    const result = await uploadMentorshipFile(file, "material");

    expect(post).toHaveBeenCalledWith("/api/v1/mentorship/admin/uploads", {
      kind: "material",
      filename: "guia.pdf",
      size: file.size,
    });
    const [url, body, options] = vi.mocked(axios.put).mock.calls[0];
    expect(url).toContain("r2.cloudflarestorage.com");
    expect(body).toBe(file);
    // Exatamente os headers assinados — e nada de Authorization para o R2.
    expect(options?.headers).toEqual({
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    expect(result).toEqual({
      url: "https://media.deepalpha.fun/key",
      sizeBytes: file.size,
      name: "guia.pdf",
    });
  });
});

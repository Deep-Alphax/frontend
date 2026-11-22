import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";

import { renderWithQuery } from "@/test/queryWrapper";
import { FileDropField } from "./FileDropField";
import * as api from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getUploadsConfig: vi.fn(),
    uploadMentorshipFile: vi.fn(),
  };
});

const MB = 1024 * 1024;
const config = (enabled: boolean): api.UploadsConfig => ({
  enabled,
  limits: { cover: 5 * MB, material: 50 * MB },
  accept: { cover: ["webp", "png", "jpg"], material: ["pdf", "zip"] },
});

function file(name: string, size: number, type = "") {
  const f = new File(["x"], name, { type });
  // `size` do File é só leitura; o conteúdo real não importa aqui.
  Object.defineProperty(f, "size", { value: size });
  return f;
}

function drop(target: HTMLElement, f: File) {
  fireEvent.drop(target, { dataTransfer: { files: [f] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getUploadsConfig).mockResolvedValue(config(true));
  vi.mocked(api.uploadMentorshipFile).mockImplementation(async (f) => ({
    url: `https://media.deepalpha.fun/mentorship/covers/x/${f.name}`,
    sizeBytes: f.size,
    name: f.name,
  }));
});

describe("FileDropField", () => {
  it("soltar uma imagem sobe e preenche a URL pública", async () => {
    const onChange = vi.fn();
    const onUploaded = vi.fn();
    renderWithQuery(
      <FileDropField
        kind="cover"
        label="Cover image"
        value=""
        onChange={onChange}
        onUploaded={onUploaded}
      />,
    );

    drop(await screen.findByTestId("drop-cover"), file("capa.webp", 200_000));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        "https://media.deepalpha.fun/mentorship/covers/x/capa.webp",
      ),
    );
    expect(vi.mocked(api.uploadMentorshipFile).mock.calls[0][1]).toBe("cover");
    expect(onUploaded).toHaveBeenCalledWith(
      expect.objectContaining({ name: "capa.webp", sizeBytes: 200_000 }),
    );
  });

  it("escolher pelo seletor também sobe", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQuery(
      <FileDropField kind="material" label="File" value="" onChange={onChange} />,
    );

    await screen.findByTestId("drop-material");
    await user.upload(screen.getByLabelText("Upload file"), file("guia.pdf", 1000));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(vi.mocked(api.uploadMentorshipFile).mock.calls[0][1]).toBe("material");
  });

  it("tipo fora da lista é recusado na hora, sem pedir URL ao servidor", async () => {
    renderWithQuery(
      <FileDropField kind="cover" label="Cover image" value="" onChange={vi.fn()} />,
    );

    drop(await screen.findByTestId("drop-cover"), file("logo.svg", 100));

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't allowed/);
    expect(api.uploadMentorshipFile).not.toHaveBeenCalled();
  });

  it("arquivo acima do limite é recusado na hora", async () => {
    renderWithQuery(
      <FileDropField kind="cover" label="Cover image" value="" onChange={vi.fn()} />,
    );

    drop(await screen.findByTestId("drop-cover"), file("big.png", 6 * MB));

    expect(await screen.findByRole("alert")).toHaveTextContent("limit is 5 MB");
    expect(api.uploadMentorshipFile).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece com o texto dele (ex.: upload não configurado)", async () => {
    vi.mocked(api.uploadMentorshipFile).mockRejectedValue(
      new AxiosError("503", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 409,
        data: { message: "File upload is not configured. Paste a link instead." },
        statusText: "",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    const onChange = vi.fn();
    renderWithQuery(
      <FileDropField kind="cover" label="Cover image" value="" onChange={onChange} />,
    );

    drop(await screen.findByTestId("drop-cover"), file("a.png", 10));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not configured/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("upload desligado no backend: só o campo de link", async () => {
    vi.mocked(api.getUploadsConfig).mockResolvedValue(config(false));
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <FileDropField kind="cover" label="Cover image" value="" onChange={onChange} />,
    );

    const link = await screen.findByLabelText("Cover image link");
    await waitFor(() => expect(api.getUploadsConfig).toHaveBeenCalled());
    expect(screen.queryByTestId("drop-cover")).not.toBeInTheDocument();

    await user.type(link, "h");
    expect(onChange).toHaveBeenLastCalledWith("h");
  });
});

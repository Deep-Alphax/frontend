import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { guessMaterialKind, MaterialsEditor } from "./MaterialsEditor";
import * as api from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    createMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    getUploadsConfig: vi.fn(async () => ({
      enabled: false,
      limits: { cover: 5 * 1024 * 1024, material: 50 * 1024 * 1024 },
      accept: { cover: ["webp", "png"], material: ["pdf", "zip"] },
    })),
  };
});
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createMat = vi.mocked(api.createMaterial);
const deleteMat = vi.mocked(api.deleteMaterial);

const material: api.AdminMaterial = {
  id: "mat1",
  lessonId: "l1",
  title: "RPC guide.pdf",
  url: "https://cdn.example.com/rpc.pdf",
  kind: "PDF",
  sizeBytes: 2516582,
  position: 0,
};

const link = () => screen.getByLabelText("File link");
const title = () => screen.getByLabelText("Material title");
const addBtn = () => screen.getByRole("button", { name: /add material/i });

describe("guessMaterialKind", () => {
  it.each([
    ["https://cdn.x/guide.PDF", "PDF"],
    ["https://cdn.x/sheet.xlsx?dl=1", "XLS"],
    ["https://cdn.x/notes.docx#p2", "DOC"],
    ["/files/config.json", "JSON"],
    ["https://cdn.x/pack.zip", "ZIP"],
    ["https://notion.so/some-page", "LINK"],
  ] as const)("%s → %s", (url, kind) => {
    expect(guessMaterialKind(url)).toBe(kind);
  });
});

describe("MaterialsEditor — aula salva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMat.mockResolvedValue({ ...material, id: "new" });
    deleteMat.mockResolvedValue(undefined);
  });

  it("lista o material com tamanho legível", () => {
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[material]} onChanged={vi.fn()} />,
    );

    expect(screen.getByText("RPC guide.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.4 MB/)).toBeInTheDocument();
  });

  it("colar o link sugere título e tipo; tamanho em MB vira bytes", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={onChanged} />,
    );

    await user.type(link(), "https://cdn.example.com/Risk%20sheet.xlsx");
    expect(title()).toHaveValue("Risk sheet.xlsx");

    await user.type(screen.getByLabelText("Size in MB"), "1.5");
    await user.click(addBtn());

    expect(createMat.mock.calls[0][0]).toBe("l1");
    expect(createMat.mock.calls[0][1]).toEqual({
      title: "Risk sheet.xlsx",
      url: "https://cdn.example.com/Risk%20sheet.xlsx",
      kind: "XLS",
      sizeBytes: Math.round(1.5 * 1024 * 1024),
    });
  });

  it("título digitado à mão não é sobrescrito pelo link", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={vi.fn()} />,
    );

    await user.type(title(), "Checklist");
    await user.type(link(), "https://cdn.example.com/x.pdf");

    expect(title()).toHaveValue("Checklist");
  });

  it("tamanho não numérico bloqueia o envio e avisa", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={vi.fn()} />,
    );

    await user.type(link(), "https://a.b/c.pdf");
    await user.type(screen.getByLabelText("Size in MB"), "abc");

    expect(screen.getByText(/Size must be a number/)).toBeInTheDocument();
    expect(addBtn()).toBeDisabled();
    expect(createMat).not.toHaveBeenCalled();
  });

  it("tamanho em branco é aceito como desconhecido (0)", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={vi.fn()} />,
    );

    await user.type(link(), "https://a.b/guide.pdf");
    await user.click(addBtn());

    expect(createMat.mock.calls[0][1].sizeBytes).toBe(0);
  });

  it("remover chama a API com o id certo", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[material]} onChanged={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove RPC guide.pdf" }));
    expect(deleteMat.mock.calls[0][0]).toBe("mat1");
  });
});

describe("MaterialsEditor — aula nova (fila)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enfileira em vez de chamar a API (a aula ainda não existe)", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    renderWithQuery(
      <MaterialsEditor
        lessonId={null}
        materials={[]}
        onChanged={vi.fn()}
        pending={[]}
        onPendingChange={onPendingChange}
      />,
    );

    await user.type(link(), "https://cdn.example.com/guide.pdf");
    await user.click(addBtn());

    expect(createMat).not.toHaveBeenCalled();
    expect(onPendingChange).toHaveBeenCalledWith([
      {
        title: "guide.pdf",
        url: "https://cdn.example.com/guide.pdf",
        kind: "PDF",
        sizeBytes: 0,
      },
    ]);
  });

  it("mostra a fila e remove dela sem chamar a API", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    const pending: api.MaterialPayload[] = [
      { title: "A.pdf", url: "https://x/a.pdf", kind: "PDF", sizeBytes: 0 },
      { title: "B.zip", url: "https://x/b.zip", kind: "ZIP", sizeBytes: 0 },
    ];
    renderWithQuery(
      <MaterialsEditor
        lessonId={null}
        materials={[]}
        onChanged={vi.fn()}
        pending={pending}
        onPendingChange={onPendingChange}
      />,
    );

    expect(screen.getByText(/Saved together with the lesson/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove A.pdf" }));

    expect(deleteMat).not.toHaveBeenCalled();
    expect(onPendingChange).toHaveBeenCalledWith([pending[1]]);
  });
});

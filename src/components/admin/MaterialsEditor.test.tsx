import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { MaterialsEditor } from "./MaterialsEditor";
import * as api from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, createMaterial: vi.fn(), deleteMaterial: vi.fn() };
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

describe("MaterialsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMat.mockResolvedValue({ ...material, id: "new" });
    deleteMat.mockResolvedValue(undefined);
  });

  it("aula ainda não salva não oferece formulário que falharia", () => {
    renderWithQuery(
      <MaterialsEditor lessonId={null} materials={[]} onChanged={vi.fn()} />,
    );

    expect(screen.getByText(/Save the lesson first/)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Title \(e\.g\./),
    ).not.toBeInTheDocument();
  });

  it("lista o material com tamanho legível", () => {
    renderWithQuery(
      <MaterialsEditor
        lessonId="l1"
        materials={[material]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("RPC guide.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.4 MB/)).toBeInTheDocument();
  });

  it("converte o tamanho digitado em MB para bytes ao salvar", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={onChanged} />,
    );

    await user.type(screen.getByPlaceholderText(/Title \(e\.g\./), "Sheet.xls");
    await user.type(
      screen.getByPlaceholderText(/file URL/),
      "https://cdn.example.com/s.xls",
    );
    await user.selectOptions(screen.getByLabelText("Type"), "XLS");
    await user.type(screen.getByLabelText("Size in MB"), "1.5");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(createMat).toHaveBeenCalledTimes(1);
    expect(createMat.mock.calls[0][0]).toBe("l1");
    expect(createMat.mock.calls[0][1]).toEqual({
      title: "Sheet.xls",
      url: "https://cdn.example.com/s.xls",
      kind: "XLS",
      sizeBytes: Math.round(1.5 * 1024 * 1024),
    });
  });

  it("tamanho não numérico bloqueia o envio e avisa", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText(/Title \(e\.g\./), "x");
    await user.type(screen.getByPlaceholderText(/file URL/), "https://a.b/c");
    await user.type(screen.getByLabelText("Size in MB"), "abc");

    expect(screen.getByText(/Size must be a number/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add/ })).toBeDisabled();
    expect(createMat).not.toHaveBeenCalled();
  });

  it("tamanho em branco é aceito como desconhecido (0)", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor lessonId="l1" materials={[]} onChanged={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText(/Title \(e\.g\./), "Link");
    await user.type(screen.getByPlaceholderText(/file URL/), "https://a.b/c");
    await user.click(screen.getByRole("button", { name: /Add/ }));

    expect(createMat.mock.calls[0][1].sizeBytes).toBe(0);
  });

  it("remover chama a API com o id certo", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MaterialsEditor
        lessonId="l1"
        materials={[material]}
        onChanged={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove RPC guide.pdf" }),
    );
    expect(deleteMat.mock.calls[0][0]).toBe("mat1");
  });
});

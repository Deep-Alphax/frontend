import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { renderWithQuery } from "@/test/queryWrapper";
import { LessonPlayer, resumeAt } from "./LessonPlayer";
import * as api from "@/lib/api/mentorship";
import * as player from "@/lib/mentorship/player";
import type { MentorshipLesson } from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, saveLessonProgress: vi.fn() };
});
vi.mock("@/lib/mentorship/player", () => ({ attachPlayer: vi.fn() }));

const save = vi.mocked(api.saveLessonProgress);
const attach = vi.mocked(player.attachPlayer);

/** Eventos que o player "emite" — capturados do `attachPlayer` mockado. */
let events: player.PlayerEvents = {};
const destroy = vi.fn();

function lesson(over: Partial<MentorshipLesson> = {}): MentorshipLesson {
  return {
    id: "l1",
    title: "Sizing a position",
    description: "",
    episode: 1,
    durationSec: 600,
    coverUrl: "",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    moduleId: "m1",
    moduleTitle: "Risk",
    positionSec: 0,
    completed: false,
    percent: 0,
    materials: [],
    ...over,
  };
}

function mount(l = lesson(), onAutoComplete = vi.fn()) {
  const utils = renderWithQuery(
    <LessonPlayer lesson={l} title={l.title} onAutoComplete={onAutoComplete} />,
  );
  return { ...utils, onAutoComplete };
}

beforeEach(() => {
  vi.clearAllMocks();
  events = {};
  save.mockResolvedValue({ lessonId: "l1", positionSec: 0, completed: false, percent: 0 });
  attach.mockImplementation(async (_iframe, _provider, ev) => {
    events = ev;
    return { destroy };
  });
});

describe("resumeAt", () => {
  it("retoma onde parou", () => {
    expect(resumeAt(lesson({ positionSec: 245.7 }))).toBe(245);
  });
  it("não retoma nos primeiros segundos, perto do fim, nem aula concluída", () => {
    expect(resumeAt(lesson({ positionSec: 3 }))).toBe(0);
    expect(resumeAt(lesson({ positionSec: 590 }))).toBe(0);
    expect(resumeAt(lesson({ positionSec: 300, completed: true }))).toBe(0);
  });
});

describe("LessonPlayer", () => {
  it("o embed liga a API do player e começa do segundo salvo", () => {
    const { container } = mount(lesson({ positionSec: 120 }));
    const src = new URL(container.querySelector("iframe")!.src);
    expect(src.searchParams.get("enablejsapi")).toBe("1");
    expect(src.searchParams.get("origin")).toBe(window.location.origin);
    expect(src.searchParams.get("start")).toBe("120");
  });

  it("salva a cada 30 s tocando, não a cada segundo", async () => {
    mount();
    await waitFor(() => expect(attach).toHaveBeenCalled());

    for (let s = 1; s <= 29; s++) act(() => events.onTime?.(s, 600));
    expect(save).not.toHaveBeenCalled();

    act(() => events.onTime?.(30, 600));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]).toEqual(["l1", { positionSec: 30 }]);

    act(() => events.onTime?.(45, 600));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("pausar salva na hora; voltar no vídeo também salva", async () => {
    mount(lesson({ positionSec: 200 }));
    await waitFor(() => expect(attach).toHaveBeenCalled());

    act(() => events.onPause?.(212.4, 600));
    expect(save.mock.calls.at(-1)).toEqual(["l1", { positionSec: 212 }]);

    act(() => events.onTime?.(100, 600)); // voltou 112 s
    expect(save.mock.calls.at(-1)).toEqual(["l1", { positionSec: 100 }]);
  });

  it("passou de 90% → conclui UMA vez, sem esperar o fim", async () => {
    const { onAutoComplete } = mount();
    await waitFor(() => expect(attach).toHaveBeenCalled());

    act(() => events.onTime?.(539, 600));
    expect(onAutoComplete).not.toHaveBeenCalled();
    act(() => events.onTime?.(541, 600));
    act(() => events.onTime?.(560, 600));
    act(() => events.onEnded?.(600));
    expect(onAutoComplete).toHaveBeenCalledTimes(1);
    expect(onAutoComplete).toHaveBeenCalledWith(541);
  });

  it("aula já concluída não conclui de novo ao reassistir", async () => {
    const { onAutoComplete } = mount(lesson({ completed: true }));
    await waitFor(() => expect(attach).toHaveBeenCalled());
    act(() => events.onTime?.(590, 600));
    act(() => events.onEnded?.(600));
    expect(onAutoComplete).not.toHaveBeenCalled();
  });

  it("trocar de aba manda a posição com keepalive (sobrevive ao fechar)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
    mount();
    await waitFor(() => expect(attach).toHaveBeenCalled());
    act(() => events.onTime?.(17, 600));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/mentorship\/lessons\/l1\/progress$/);
    expect(init).toMatchObject({ method: "PATCH", keepalive: true, credentials: "include" });
    expect(JSON.parse(String(init?.body))).toEqual({ positionSec: 17 });
    fetchSpy.mockRestore();
  });

  it("sair da aula salva a posição e solta o player", async () => {
    const { unmount } = mount();
    await waitFor(() => expect(attach).toHaveBeenCalled());
    act(() => events.onTime?.(12, 600));

    unmount();
    expect(save.mock.calls.at(-1)).toEqual(["l1", { positionSec: 12 }]);
    expect(destroy).toHaveBeenCalled();
  });

  it("API do player bloqueada não quebra a aula (vídeo continua)", async () => {
    attach.mockRejectedValueOnce(new Error("blocked"));
    const { container } = mount();
    await waitFor(() => expect(attach).toHaveBeenCalled());
    expect(container.querySelector("iframe")).toBeInTheDocument();
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import toast from "react-hot-toast";

import { couponLink, couponStatus, CouponsAdmin } from "./CouponsAdmin";
import type {
  AdminCoupon,
  AdminCouponRedemption,
  CreateCouponInput,
  UpdateCouponInput,
} from "@/lib/api/coupons";
import { API_URL } from "@/lib/env";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const BASE = `${API_URL}/api/v1/billing/coupons/admin`;

function coupon(over: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: "c1",
    code: "LAUNCH30",
    days: 30,
    maxRedemptions: 100,
    redeemedCount: 12,
    expiresAt: null,
    active: true,
    note: "Launch campaign",
    createdAt: "2026-11-01T12:00:00.000Z",
    ...over,
  };
}

const REDEMPTIONS: AdminCouponRedemption[] = [
  {
    id: "r1",
    userId: "u1",
    userEmail: "ana@deepalpha.fun",
    redeemedAt: "2026-11-02T12:00:00.000Z",
    periodEnd: "2026-12-02T12:00:00.000Z",
  },
  {
    id: "r2",
    userId: null,
    userEmail: "gone@deepalpha.fun",
    redeemedAt: "2026-11-03T12:00:00.000Z",
    periodEnd: "2026-12-03T12:00:00.000Z",
  },
];

// "Banco" em memória dos handlers do contrato — cada teste começa do zero.
let db: AdminCoupon[] = [];
const created: CreateCouponInput[] = [];
const patches: { id: string; body: UpdateCouponInput }[] = [];

const server = setupServer(
  http.get(BASE, () => HttpResponse.json(db)),
  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as CreateCouponInput;
    created.push(body);
    if (db.some((c) => c.code === body.code)) {
      return HttpResponse.json(
        { message: "A coupon with this code already exists." },
        { status: 409 },
      );
    }
    const next = coupon({
      id: `c${db.length + 1}`,
      code: body.code,
      days: body.days,
      maxRedemptions: body.maxRedemptions,
      redeemedCount: 0,
      expiresAt: body.expiresAt ?? null,
      note: body.note ?? null,
      createdAt: new Date().toISOString(),
    });
    db = [next, ...db];
    return HttpResponse.json(next, { status: 201 });
  }),
  http.patch(`${BASE}/:id`, async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as UpdateCouponInput;
    patches.push({ id, body });
    const current = db.find((c) => c.id === id);
    if (!current) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const next = { ...current, ...body };
    db = db.map((c) => (c.id === id ? next : c));
    return HttpResponse.json(next);
  }),
  http.get(`${BASE}/:id/redemptions`, ({ params }) =>
    HttpResponse.json(params.id === "c1" ? REDEMPTIONS : []),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("CouponsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    created.length = 0;
    patches.length = 0;
    db = [
      coupon(),
      coupon({ id: "c2", code: "OFF", active: false, note: null }),
      coupon({ id: "c3", code: "OLD", expiresAt: "2020-01-01T00:00:00.000Z" }),
      coupon({ id: "c4", code: "FULL", redeemedCount: 100 }),
    ];
  });

  it("lista os cupons com uso, status derivado, validade e nota", async () => {
    renderWithQuery(<CouponsAdmin />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent("LAUNCH30");
    expect(rows[0]).toHaveTextContent("12 / 100");
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[0]).toHaveTextContent("Never");
    expect(rows[0]).toHaveTextContent("Launch campaign");
    expect(rows[1]).toHaveTextContent("Disabled");
    expect(rows[2]).toHaveTextContent("Expired");
    expect(rows[3]).toHaveTextContent("Exhausted");
  });

  it("cria um cupom: código em maiúsculas, validade no fim do dia, e entra na lista", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Code"), "summer-7");
    expect(screen.getByLabelText("Code")).toHaveValue("SUMMER-7");
    await user.clear(screen.getByLabelText("Days of Pro"));
    await user.type(screen.getByLabelText("Days of Pro"), "7");
    await user.clear(screen.getByLabelText("Max redemptions"));
    await user.type(screen.getByLabelText("Max redemptions"), "50");
    await user.type(screen.getByLabelText("Expires on (optional)"), "2099-01-31");
    await user.type(screen.getByLabelText("Note (optional)"), "KOL X");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Coupon SUMMER-7 created."));
    expect(created).toEqual([
      {
        code: "SUMMER-7",
        days: 7,
        maxRedemptions: 50,
        expiresAt: new Date("2099-01-31T23:59:59.999").toISOString(),
        note: "KOL X",
      },
    ]);
    const table = screen.getByRole("table");
    expect(await within(table).findByText("SUMMER-7")).toBeInTheDocument();
    // Formulário volta ao padrão.
    expect(screen.getByLabelText("Code")).toHaveValue("");
  });

  it("validação no cliente: código, dias, teto e validade no passado não chegam ao servidor", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Code"), "a!");
    await user.clear(screen.getByLabelText("Days of Pro"));
    await user.type(screen.getByLabelText("Days of Pro"), "400");
    await user.clear(screen.getByLabelText("Max redemptions"));
    await user.type(screen.getByLabelText("Expires on (optional)"), "2020-01-01");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(await screen.findByText("3 to 32 characters: A–Z, 0–9 or -")).toBeInTheDocument();
    expect(screen.getByText("Between 1 and 365 days")).toBeInTheDocument();
    expect(screen.getByText("Enter how many redemptions")).toBeInTheDocument();
    expect(screen.getByText("Must be a future date")).toBeInTheDocument();
    expect(created).toEqual([]);
  });

  it("409 (código já existe): a mensagem do servidor aparece no campo do código", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Code"), "LAUNCH30");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(await screen.findByText("A coupon with this code already exists.")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("desativa e reativa pelo botão da linha", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    const table = await screen.findByRole("table");
    const row = () => within(table).getByText("LAUNCH30").closest("tr")!;

    await user.click(within(row()).getByRole("button", { name: "Disable LAUNCH30" }));
    await waitFor(() => expect(row()).toHaveTextContent("Disabled"));
    expect(patches).toEqual([{ id: "c1", body: { active: false } }]);
    expect(toast.success).toHaveBeenCalledWith("LAUNCH30 disabled.");

    await user.click(within(row()).getByRole("button", { name: "Enable LAUNCH30" }));
    await waitFor(() => expect(row()).toHaveTextContent("Active"));
    expect(patches[1]).toEqual({ id: "c1", body: { active: true } });
  });

  it("edita o teto de usos, sem deixar abaixo do que já foi resgatado", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    const table = await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Edit max redemptions for LAUNCH30" }));
    const input = screen.getByLabelText("Max redemptions for LAUNCH30");
    await user.clear(input);
    await user.type(input, "5");
    expect(screen.getByText("At least 12")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "250");
    await user.click(within(table).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(within(table).getByText("12 / 250")).toBeInTheDocument());
    expect(patches).toEqual([{ id: "c1", body: { maxRedemptions: 250 } }]);
  });

  it("'View' lista quem resgatou (e-mail, data, PRO até)", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CouponsAdmin />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "View redemptions of LAUNCH30" }));
    const panel = await screen.findByRole("table", { name: "Redemptions of LAUNCH30" });
    const rows = within(panel).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("ana@deepalpha.fun");
    expect(rows[0]).toHaveTextContent("Nov 2, 2026");
    expect(rows[0]).toHaveTextContent("Dec 2, 2026");
    expect(rows[1]).toHaveTextContent("(deleted account)");

    await user.click(screen.getByRole("button", { name: "View redemptions of OFF" }));
    expect(await screen.findByText("No redemptions yet.")).toBeInTheDocument();
  });

  it("copia o link compartilhável do cupom", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderWithQuery(<CouponsAdmin />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Copy link for LAUNCH30" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/plans?coupon=LAUNCH30`);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Coupon link copied."));
  });

  it("vazio", async () => {
    db = [];
    renderWithQuery(<CouponsAdmin />);
    expect(await screen.findByText("No coupons yet.")).toBeInTheDocument();
  });
});

describe("couponStatus / couponLink", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");

  it("desativado manda sobre vencido e esgotado", () => {
    expect(
      couponStatus(coupon({ active: false, expiresAt: "2020-01-01T00:00:00Z", redeemedCount: 100 }), now),
    ).toBe("DISABLED");
    expect(couponStatus(coupon({ expiresAt: "2026-11-09T11:00:00Z", redeemedCount: 100 }), now)).toBe(
      "EXPIRED",
    );
    expect(couponStatus(coupon({ redeemedCount: 100 }), now)).toBe("EXHAUSTED");
    expect(couponStatus(coupon({ expiresAt: "2026-12-01T00:00:00Z" }), now)).toBe("ACTIVE");
  });

  it("monta o link de /plans com o código", () => {
    expect(couponLink("https://app.deepalpha.fun", "LAUNCH30")).toBe(
      "https://app.deepalpha.fun/plans?coupon=LAUNCH30",
    );
  });
});

import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

import { planErrorCode } from "@/lib/billing/planErrors";

/** AxiosError com a resposta que o backend manda. */
function httpError(status: number, data: unknown): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("x", "ERR", { headers }, null, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers },
  });
}

describe("planErrorCode", () => {
  it("reconhece os 403 de plano pelo código estável", () => {
    expect(planErrorCode(httpError(403, { code: "PLAN_LIMIT", limit: 1 }))).toBe("PLAN_LIMIT");
    expect(planErrorCode(httpError(403, { code: "PLAN_REQUIRED" }))).toBe("PLAN_REQUIRED");
  });

  it("reconhece o 403 do acesso restrito (Elixir Alpha no FREE)", () => {
    expect(
      planErrorCode(
        httpError(403, {
          code: "ACCESS_RESTRICTED",
          message: "This feature isn't included in your access.",
        }),
      ),
    ).toBe("ACCESS_RESTRICTED");
  });

  it("não confunde com outros 403 nem com outros status", () => {
    expect(planErrorCode(httpError(403, { message: "Forbidden" }))).toBeNull();
    expect(planErrorCode(httpError(400, { code: "PLAN_LIMIT" }))).toBeNull();
    expect(planErrorCode(new Error("boom"))).toBeNull();
    expect(planErrorCode(undefined)).toBeNull();
  });
});

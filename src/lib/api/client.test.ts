import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";

import { getAdminErrorMessage, getApiErrorMessage } from "./client";

function httpError(status: number, data: unknown) {
  return new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

/** Corpo real do ValidationPipe do backend (visto no E2E de 22/11). */
const validationBody = {
  statusCode: 400,
  message: "Validation failed",
  errors: [
    {
      property: "coverUrl",
      value: "",
      message: 'coverUrl must be an http(s) URL or a path starting with "/"',
      constraints: { matches: "…" },
    },
  ],
};

describe("getApiErrorMessage", () => {
  it("erro de validação em OBJETO vira o texto dele, nunca o objeto", () => {
    const msg = getApiErrorMessage(httpError(400, validationBody), "fallback");
    expect(typeof msg).toBe("string");
    expect(msg).toBe('coverUrl must be an http(s) URL or a path starting with "/"');
  });

  it("continua aceitando errors como string", () => {
    expect(getApiErrorMessage(httpError(400, { errors: ["Bad slug"] }))).toBe("Bad slug");
  });

  it("errors sem texto utilizável cai na message", () => {
    expect(
      getApiErrorMessage(httpError(400, { errors: [{}], message: "Validation failed" })),
    ).toBe("Validation failed");
  });

  it("admin: 400 de validação também sai como texto", () => {
    expect(getAdminErrorMessage(httpError(400, validationBody), "fallback")).toMatch(
      /^coverUrl must be/,
    );
  });
});

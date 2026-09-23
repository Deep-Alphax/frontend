import { describe, expect, it } from "vitest";

import { isUserRejection, walletErrorMessage } from "./walletErrors";

describe("walletErrors", () => {
  it("reconhece recusa em qualquer ponto da cadeia", () => {
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(
      isUserRejection({ name: "TransactionExecutionError", cause: { name: "UserRejectedRequestError" } }),
    ).toBe(true);
    expect(
      isUserRejection({ name: "WalletSendTransactionError", error: { message: "User rejected the request." } }),
    ).toBe(true);
    expect(isUserRejection(new Error("insufficient funds"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });

  it("mensagem: recusa amigável; outros erros só a primeira linha", () => {
    expect(walletErrorMessage({ code: 4001 })).toBe(
      "You cancelled the request in your wallet.",
    );
    expect(
      walletErrorMessage({ shortMessage: "Insufficient funds\nRequest args: …" }),
    ).toBe("Your wallet could not complete this: Insufficient funds");
    expect(walletErrorMessage(undefined)).toBe(
      "Your wallet could not complete this. Please try again.",
    );
  });
});

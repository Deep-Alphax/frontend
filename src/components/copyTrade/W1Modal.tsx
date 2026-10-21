"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  confirmAddress,
  confirmWithdraw,
  removeAddress,
  requestAddressCode,
  requestWithdrawCode,
} from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { sol } from "@/lib/copyTrade/format";
import { useInvalidateW1, useW1 } from "@/lib/copyTrade/useCopies";
import { Modal } from "@/components/walletReader/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { TagButton } from "@/components/copyTrade/parts";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * W1 — depositar e sacar. SEM design no Figma (o Figma só tem o botão
 * "Depositar na W1"): montado com os componentes do DS. Existe porque não se
 * pode aceitar depósito sem caminho de saída.
 *
 * Saque (decisão 2026-10-20): só para endereço cadastrado — código por e-mail
 * e 24 h de carência — e cada saque confirmado por código amarrado ao
 * endereço e ao valor exatos. O signer executa e revalida tudo.
 */
export function W1Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const w1 = useW1(open);
  const d = w1.data;

  return (
    <Modal open={open} onClose={onClose} title="Your W1" className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="W1 action" className="flex gap-1">
          <TagButton selected={tab === "deposit"} onClick={() => setTab("deposit")}>
            Deposit
          </TagButton>
          <TagButton selected={tab === "withdraw"} onClick={() => setTab("withdraw")}>
            Withdraw
          </TagButton>
        </div>
        {!d ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : !d.wallet ? (
          <p className="text-sm text-gray-11">
            Your W1 is created with your first copy. Start copying a wallet to get your deposit address.
          </p>
        ) : tab === "deposit" ? (
          <Deposit address={d.wallet.address} balanceSol={d.wallet.balanceSol} />
        ) : (
          <Withdraw state={d} />
        )}
      </div>
    </Modal>
  );
}

function Deposit({ address, balanceSol }: { address: string; balanceSol: number | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-1 p-4">
        <p className="text-xs leading-[1.3] text-gray-11">Balance</p>
        <p className="font-display text-2xl leading-[1.1] font-semibold tracking-[1px] text-gray-12">{sol(balanceSol)}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs leading-[1.3] text-gray-11">Send SOL (Solana network only) to:</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-6 bg-gray-1 p-3">
          <code className="min-w-0 flex-1 break-all text-sm text-gray-12">{address}</code>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(address).then(
                () => toast.success("Address copied."),
                () => toast.error("Could not copy."),
              )
            }
            className="shrink-0 rounded border border-gray-6 bg-gray-3 px-2 py-1 text-xs font-medium text-gray-12 hover:bg-gray-4"
          >
            Copy
          </button>
        </div>
        <p className="text-xs leading-[1.3] text-gray-11">
          Only send SOL on Solana. Copies stopped for low balance resume on their own once the deposit lands.
        </p>
      </div>
    </div>
  );
}

function Withdraw({ state }: { state: NonNullable<ReturnType<typeof useW1>["data"]> }) {
  const invalidate = useInvalidateW1();
  const [newAddr, setNewAddr] = useState("");
  const [addrCode, setAddrCode] = useState("");
  const [addrSent, setAddrSent] = useState(false);
  const [to, setTo] = useState(state.addresses.find((a) => a.active)?.address ?? "");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const amountSol = Number(amount);
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e));

  const sendAddrCode = useMutation({ mutationFn: () => requestAddressCode(newAddr.trim()), onSuccess: () => setAddrSent(true), onError: onErr });
  const saveAddr = useMutation({
    mutationFn: () => confirmAddress(newAddr.trim(), addrCode.trim()),
    onSuccess: () => {
      toast.success("Address added. It unlocks for withdrawals in 24 h.");
      setNewAddr("");
      setAddrCode("");
      setAddrSent(false);
      invalidate();
    },
    onError: onErr,
  });
  const delAddr = useMutation({ mutationFn: (id: string) => removeAddress(id), onSuccess: invalidate, onError: onErr });
  const sendCode = useMutation({ mutationFn: () => requestWithdrawCode(to, amountSol), onSuccess: () => setCodeSent(true), onError: onErr });
  const withdraw = useMutation({
    mutationFn: () => confirmWithdraw(to, amountSol, code.trim()),
    onSuccess: () => {
      toast.success("Withdrawal requested.");
      setAmount("");
      setCode("");
      setCodeSent(false);
      invalidate();
    },
    onError: onErr,
  });

  const field = "w-full rounded-lg border border-gray-6 bg-gray-1 px-3 py-2 text-sm text-gray-12 outline-none focus:border-gray-8";
  const btn = "rounded-lg bg-principal-9 px-4 py-2 text-sm font-semibold text-gray-1 hover:bg-principal-10 disabled:opacity-50";
  const active = state.addresses.filter((a) => a.active);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-12">Withdrawal addresses</h3>
        {state.addresses.length ? (
          <ul className="flex flex-col gap-1">
            {state.addresses.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-gray-6 px-3 py-2 text-xs">
                <code className="min-w-0 flex-1 truncate text-gray-12">{a.address}</code>
                <span className={a.active ? "text-green-11" : "text-principal-11"}>
                  {a.active ? "Active" : `Unlocks ${new Date(a.activeAt).toLocaleString("en-US")}`}
                </span>
                <button type="button" onClick={() => delAddr.mutate(a.id)} className="text-gray-11 hover:text-vermelho-11">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-11">No address yet. New addresses unlock 24 h after you confirm them.</p>
        )}
        <div className="flex gap-2">
          <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="New Solana address" spellCheck={false} className={field} />
          {!addrSent ? (
            <button type="button" disabled={!SOLANA_ADDRESS.test(newAddr.trim()) || sendAddrCode.isPending} onClick={() => sendAddrCode.mutate()} className={cn(btn, "shrink-0")}>
              Send code
            </button>
          ) : (
            <>
              <input value={addrCode} onChange={(e) => setAddrCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} className={cn(field, "w-32")} />
              <button type="button" disabled={addrCode.trim().length !== 6 || saveAddr.isPending} onClick={() => saveAddr.mutate()} className={cn(btn, "shrink-0")}>
                Confirm
              </button>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-12">Withdraw SOL</h3>
        {active.length ? (
          <>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={field}>
              {active.map((a) => (
                <option key={a.id} value={a.address}>
                  {a.address}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCodeSent(false);
                }}
                placeholder={`Amount (max ${sol(state.wallet?.balanceSol)})`}
                inputMode="decimal"
                className={field}
              />
              {!codeSent ? (
                <button type="button" disabled={!(amountSol > 0) || !to || sendCode.isPending} onClick={() => sendCode.mutate()} className={cn(btn, "shrink-0")}>
                  Send code
                </button>
              ) : (
                <>
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} className={cn(field, "w-32")} />
                  <button type="button" disabled={code.trim().length !== 6 || withdraw.isPending} onClick={() => withdraw.mutate()} className={cn(btn, "shrink-0")}>
                    Withdraw
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-11">The code we email is valid only for this address and this amount.</p>
          </>
        ) : (
          <p className="text-xs text-gray-11">Add an address above. You can withdraw once it unlocks.</p>
        )}
      </section>

      {state.withdrawals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-12">Recent withdrawals</h3>
          <ul className="flex flex-col gap-1 text-xs">
            {state.withdrawals.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-lg border border-gray-6 px-3 py-2">
                <span className="text-gray-12">{sol(w.amountSol)}</span>
                <code className="min-w-0 flex-1 truncate text-gray-11">{w.toAddress}</code>
                <span className={w.status === "SENT" ? "text-green-11" : w.status === "FAILED" ? "text-vermelho-11" : "text-principal-11"}>
                  {w.status === "SENT" ? "Sent" : w.status === "FAILED" ? "Failed" : "Processing"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

import { Modal } from "@/components/walletReader/Modal";

/** Modal de criação de um novo KOL manual. */
export function AddKolModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, wallet?: { name: string; address: string }) => void;
}) {
  const [name, setName] = useState("");
  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");

  const reset = () => {
    setName("");
    setWName("");
    setWAddr("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar KOL"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              const addr = wAddr.trim();
              onCreate(n, addr ? { name: wName.trim() || "Principal", address: addr } : undefined);
              reset();
            }}
            className="h-9 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            Criar KOL
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-11">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="ex: Cupsey"
            className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-11">Apelido da carteira (opcional)</span>
          <input
            value={wName}
            onChange={(e) => setWName(e.target.value)}
            placeholder="Principal"
            className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-11">Endereço da carteira (opcional)</span>
          <input
            value={wAddr}
            onChange={(e) => setWAddr(e.target.value)}
            placeholder="cole o endereço on-chain"
            className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 font-mono text-xs text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
        </label>
      </div>
    </Modal>
  );
}

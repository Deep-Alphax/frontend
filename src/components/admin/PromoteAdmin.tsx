"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { setUserRole, type UserRole } from "@/lib/api/admin";
import { getApiErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Gestão de role: promove/rebaixa um usuário pelo email (só admin). */
export function PromoteAdmin() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");

  const mutation = useMutation({
    mutationFn: () => setUserRole(email.trim(), role),
    onSuccess: (u) => {
      toast.success(`${u.email} agora é ${u.role}`);
      setEmail("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Falha ao alterar a role")),
  });

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-12">Gerenciar administradores</h2>
        <p className="text-sm text-gray-11">Promove ou rebaixa um usuário pelo email.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Email do usuário"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@exemplo.com"
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-40">
          <label htmlFor="role-select" className="text-base text-gray-12">
            Role
          </label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-12 rounded-lg border border-gray-6 bg-gray-2 px-3 text-gray-12 outline-none focus:border-secundaria-11"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
        </div>

        <Button
          className="w-auto sm:w-40"
          disabled={!email.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
    </section>
  );
}

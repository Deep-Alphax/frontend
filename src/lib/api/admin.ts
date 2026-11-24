/*
 * Cargo do usuário — a fonte é o contrato do Elixir Alpha (`access.ts`).
 * Re-exportado aqui para quem já importava de `api/admin`.
 *
 * A antiga troca de cargo por e-mail (`POST /users/set-role`, aba "Admins" do
 * Feed) foi substituída pela tela /admin/users (`listAdminUsers` /
 * `setAdminUserRole` / `bulkSetRole` em `access.ts`).
 */
export type { UserRole } from "@/lib/api/access";

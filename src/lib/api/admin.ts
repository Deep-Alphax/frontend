import { api } from "@/lib/api/client";

export type UserRole = "USER" | "ADMIN";

/** POST /api/v1/users/set-role — define a role de um usuário pelo email (ADMIN). */
export async function setUserRole(
  email: string,
  role: UserRole,
): Promise<{ id: string; email: string; role: UserRole }> {
  const { data } = await api.post<{ id: string; email: string; role: UserRole }>(
    "/api/v1/users/set-role",
    { email, role },
  );
  return data;
}

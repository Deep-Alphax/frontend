import type { Metadata } from "next";

import { MentorshipScreen } from "@/components/mentorship/MentorshipScreen";

/* Mentoria (node Figma 1011:21678) — trilhas, aulas e progresso. Rota protegida
 * pelo middleware (`src/proxy.ts`): sem sessão, redireciona para /login. */
export const metadata: Metadata = { title: "Mentorship" };

export default function MentorshipPage() {
  return <MentorshipScreen />;
}

import type { Metadata } from "next";
import { HomeScreen } from "@/components/home/HomeScreen";

/*
 * Home autenticada. O acesso é protegido pelo middleware (`src/proxy.ts`):
 * sem sessão, esta rota redireciona para /login.
 */
export const metadata: Metadata = {
  title: "Meu perfil",
};

export default function Home() {
  return <HomeScreen />;
}

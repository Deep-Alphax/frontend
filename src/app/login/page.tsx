import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/LoginScreen";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse a plataforma Deep Alpha.",
};

export default function LoginPage() {
  return <LoginScreen />;
}

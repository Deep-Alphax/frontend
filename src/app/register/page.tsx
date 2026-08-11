import type { Metadata } from "next";
import { RegisterScreen } from "@/components/register/RegisterScreen";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na plataforma Deep Alpha.",
};

export default function RegisterPage() {
  return <RegisterScreen />;
}

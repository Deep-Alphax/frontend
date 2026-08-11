import type { Metadata } from "next";
import { RegisterSuccess } from "@/components/register/RegisterSuccess";

export const metadata: Metadata = {
  title: "Cadastro concluído",
  description: "Sua conta Deep Alpha está ativa.",
};

export default function RegisterSuccessPage() {
  return <RegisterSuccess />;
}

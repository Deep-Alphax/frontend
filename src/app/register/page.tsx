import type { Metadata } from "next";
import { RegisterScreen } from "@/components/register/RegisterScreen";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Deep Alpha account.",
};

export default function RegisterPage() {
  return <RegisterScreen />;
}

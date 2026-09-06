import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access the Deep Alpha platform.",
};

export default function LoginPage() {
  return <LoginScreen />;
}

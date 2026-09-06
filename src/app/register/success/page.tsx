import type { Metadata } from "next";
import { RegisterSuccess } from "@/components/register/RegisterSuccess";

export const metadata: Metadata = {
  title: "Account created",
  description: "Your Deep Alpha account is active.",
};

export default function RegisterSuccessPage() {
  return <RegisterSuccess />;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { TurnstileField } from "@/components/login/TurnstileField";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/auth";
import { register as registerAccount } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });

  // Acompanha a senha em tempo real para alimentar o medidor de força.
  // `useWatch` (em vez de `watch()`) é compatível com o React Compiler.
  const passwordValue = useWatch({ control, name: "password" });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      registerAccount({
        complete_name: values.name,
        email: values.email,
        password: values.password,
        // O rodapé "Ao continuar você aceita os Termos e a Política" torna o
        // aceite implícito no envio (não há checkbox no design).
        acceptedTerms: true,
        acceptedPrivacyPolicy: true,
        language: "PT",
        turnstileToken,
      }),
    onSuccess: () => {
      // Cadastro autologa (cookies já setados) → tela de conclusão.
      router.replace("/register/success");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const onSubmit = handleSubmit((values) => registerMutation.mutate(values));

  const awaitingTurnstile = Boolean(TURNSTILE_SITE_KEY) && !turnstileToken;
  const isSubmitting = registerMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-8" noValidate>
      <div className="flex w-full flex-col gap-8">
        {/* Título */}
        <div className="flex w-full flex-col gap-5 text-gray-12">
          <h1 className="font-display text-2xl font-extrabold leading-[1.1] tracking-[1px]">
            Criar conta
          </h1>
          <p className="text-base">
            Preencha os campos abaixo para concluir seu acesso
          </p>
        </div>

        {/* Campos + medidor */}
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-6">
            <TextField
              label="Como podemos te chamar"
              type="text"
              autoComplete="name"
              placeholder="Seu nome ou apelido"
              leftIcon={<User className="size-5" strokeWidth={1.5} />}
              error={errors.name?.message}
              {...register("name")}
            />

            <TextField
              label="E-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Digite seu email"
              leftIcon={<Mail className="size-5" strokeWidth={1.5} />}
              error={errors.email?.message}
              {...register("email")}
            />

            <TextField
              label="Senha"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Digite sua senha"
              leftIcon={<Lock className="size-5" strokeWidth={1.5} />}
              error={errors.password?.message}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="flex items-center text-gray-11 transition-colors hover:text-gray-12"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="size-5" strokeWidth={1.5} />
                  )}
                </button>
              }
              {...register("password")}
            />
          </div>

          <PasswordStrengthMeter password={passwordValue} />
        </div>
      </div>

      <TurnstileField onToken={setTurnstileToken} />

      {/* Ação (botão auto, alinhado à direita) */}
      <div className="flex w-full justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || awaitingTurnstile}
          className="w-auto"
        >
          {isSubmitting ? "Criando conta..." : "Continuar"}
        </Button>
      </div>
    </form>
  );
}

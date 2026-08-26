"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Checkbox } from "@/components/ui/Checkbox";
import { TurnstileField } from "@/components/login/TurnstileField";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth";
import { login, isMfaChallenge, buildGoogleAuthUrl } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

/** Destino pós-login (dashboard ainda não existe → home, que redireciona). */
const POST_LOGIN_REDIRECT = "/";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      login({
        email: values.email,
        password: values.password,
        turnstileToken,
      }),
    onSuccess: (result) => {
      if (isMfaChallenge(result)) {
        // 2FA por e-mail: o backend já enviou o OTP. A tela de verificação
        // ainda não faz parte deste escopo — avisamos o usuário sem quebrar.
        // TODO(auth): implementar /login/mfa consumindo result.mfaToken.
        toast("Enviamos um código de verificação para o seu e-mail.", {
          icon: "✉️",
        });
        return;
      }
      toast.success("Login efetuado com sucesso!");
      router.replace(POST_LOGIN_REDIRECT);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const onSubmit = handleSubmit((values) => loginMutation.mutate(values));

  // Em prod (site key configurada) exigimos o token antes de habilitar o envio.
  const awaitingTurnstile = Boolean(TURNSTILE_SITE_KEY) && !turnstileToken;
  const isSubmitting = loginMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-8" noValidate>
      {/* Cabeçalho + campos */}
      <div className="flex w-full flex-col gap-7">
        <div className="flex flex-col items-center gap-4 text-gray-12">
          <h1 className="font-display text-display-24">
            Entrar
          </h1>
          <p className="text-lg">Continue de onde parou</p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-6">
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
              autoComplete="current-password"
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

          <div className="flex w-full items-center justify-between">
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  label="Lembrar conta"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

           {/*  <Link
              href="/forgot-password"
              className="text-base text-gray-11 transition-colors hover:text-gray-12"
            >
              Esqueci minha senha
            </Link> */}
          </div>
        </div>
      </div>

      <TurnstileField onToken={setTurnstileToken} />

      {/* Ações */}
      <div className="flex w-full flex-col gap-3">
        <Button type="submit" disabled={isSubmitting || awaitingTurnstile}>
          {isSubmitting ? "Entrando..." : "Entrar na plataforma"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => {
            window.location.href = buildGoogleAuthUrl(POST_LOGIN_REDIRECT);
          }}
        >
          {/* Ícone monocromático exportado do Figma (fill gray-12). SVG → <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/google.svg" alt="" aria-hidden className="size-6" />
          Fazer login com o Google
        </Button>
      </div>

      <div className="h-px w-full bg-gray-6" />

      <div className="flex items-center justify-center gap-2 text-base">
        <span className="text-gray-12">Ainda não tem conta?</span>
        <Link
          href="/register"
          className="font-medium text-secundaria-11 underline underline-offset-2"
        >
          Criar conta
        </Link>
      </div>
    </form>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-1 px-6 text-center">
      <p className="font-display text-display-48 text-gray-12">404</p>
      <h1 className="text-lg text-gray-11">Página não encontrada</h1>
      <Link
        href="/login"
        className="mt-2 font-medium text-secundaria-11 underline underline-offset-2"
      >
        Voltar para o login
      </Link>
    </main>
  );
}

import { Topbar } from "@/components/home/Topbar";
import { ProfileContent } from "@/components/home/ProfileContent";

/**
 * Home autenticada ("Meu perfil"). O conteúdo é dirigido por dados reais
 * (`ProfileContent`): estado vazio "conecte uma carteira" quando não há trades,
 * ou o dashboard de métricas (node Figma 10:71) quando há.
 */
export function HomeScreen() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="flex w-full flex-col px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
        <div className="flex w-full flex-col gap-10 max-w-7xl mx-auto">
          {/* Cabeçalho da seção */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="font-display text-display-24 text-gray-12">
              Meu perfil
            </h1>
            <p className="text-base text-gray-11 md:text-right">
              Todo número aqui vem das suas transações on-chain, já descontadas
              taxas, gas, tip e slippage.
            </p>
          </div>

          <ProfileContent />
        </div>
      </main>
    </div>
  );
}

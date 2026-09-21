import { redirect } from "next/navigation";

/* `/admin` não é uma tela — é o atalho que se digita na barra de endereço.
 *
 * Manda para a primeira aba do header (`AdminNav`), em vez de devolver 404.
 * Se a ordem do header mudar, este destino deve acompanhar.
 *
 * Sem `metadata`: a resposta é um redirect, então nada é renderizado. O
 * `robots: noindex` do layout já cobre a rota. */
export default function AdminIndexPage() {
  redirect("/admin/mentorship");
}

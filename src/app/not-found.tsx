import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>Esta página não foi encontrada.</h1>
      <p>O conteúdo pode ter mudado de endereço ou ainda não está publicado.</p>
      <Link href="/" className="button">Voltar ao início</Link>
    </main>
  );
}

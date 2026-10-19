import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Acesso administrativo", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <main className="login-page">
      <div className="login-page__visual">
        <Image src="/images/junior-coringa-corpo-inteiro.webp" alt="Junior Coringa" width={800} height={1200} priority />
        <div><span>Aqui trabalha</span><h1>Conteúdo novo,<br />mandato mais perto.</h1></div>
      </div>
      <div className="login-page__form-wrap">
        <div className="login-card">
          <Image className="login-logo" src="/images/logo-junior-coringa.webp" alt="Junior Coringa" width={210} height={124} priority />
          <span className="login-kicker">Área administrativa</span>
          <h2>Bem-vindo de volta.</h2>
          <p>Entre para publicar notícias, projetos e agendas do mandato.</p>
          <LoginForm />
          <a href="/" className="login-back">← Voltar para o site</a>
        </div>
      </div>
    </main>
  );
}

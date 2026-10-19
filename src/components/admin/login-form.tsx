"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      router.push("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>E-mail</span>
        <div className="admin-input-icon"><Mail size={18} /><input name="email" type="email" autoComplete="username" required /></div>
      </label>
      <label>
        <span>Senha</span>
        <div className="admin-input-icon"><LockKeyhole size={18} /><input name="password" type="password" autoComplete="current-password" required /></div>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button admin-submit" type="submit" disabled={loading}>
        {loading ? "Entrando..." : <>Entrar no painel <ArrowRight size={18} /></>}
      </button>
    </form>
  );
}

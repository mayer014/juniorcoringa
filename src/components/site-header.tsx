"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Início" },
  { href: "/#mandato", label: "O mandato" },
  { href: "/#bandeiras", label: "Bandeiras" },
  { href: "/#galeria", label: "Galeria" },
  { href: "/noticias", label: "Notícias e projetos" },
  { href: "/atuacao-legislativa", label: "Atuação legislativa" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const solid = /^\/atuacao-legislativa\/.+/.test(pathname);

  return (
    <header className={`site-header${solid ? " site-header--solid" : ""}`}>
      <div className="shell site-header__inner">
        <Link href="/" className="brand" aria-label="Junior Coringa — página inicial">
          <Image
            src="/images/logo-junior-coringa.webp"
            width={240}
            height={142}
            alt="Vereador Junior Coringa — Aqui Trabalha"
            priority
          />
        </Link>

        <button
          className="menu-toggle"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav className={`main-nav${open ? " is-open" : ""}`} aria-label="Navegação principal">
          {links.map((link) => {
            const isActive = (link.href === "/noticias" && pathname.startsWith("/noticias")) ||
              (link.href === "/atuacao-legislativa" && pathname.startsWith("/atuacao-legislativa"));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? "is-active" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <Link className="button button--small" href="/#contato" onClick={() => setOpen(false)}>
            Fale com o mandato
          </Link>
        </nav>
      </div>
    </header>
  );
}

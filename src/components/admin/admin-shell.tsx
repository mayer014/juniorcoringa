"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, FilePlus2, Images, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const links = [
    { href: "/admin", label: "Publicações", icon: LayoutDashboard, exact: true },
    { href: "/admin/nova", label: "Nova matéria", icon: FilePlus2 },
    { href: "/admin/galeria", label: "Galeria", icon: Images },
  ];

  return (
    <div className="admin-layout">
      <button className="admin-mobile-menu" type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
        {open ? <X /> : <Menu />}
      </button>
      <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
        <Link href="/" className="admin-brand">
          <Image src="/images/logo-junior-coringa.webp" alt="Junior Coringa" width={175} height={104} priority />
        </Link>
        <div className="admin-account">
          <span className="admin-avatar">JC</span>
          <div><strong>Painel do mandato</strong><small>{email}</small></div>
        </div>
        <nav className="admin-nav">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return <Link key={link.href} href={link.href} className={active ? "is-active" : ""} onClick={() => setOpen(false)}><Icon size={19} /> {link.label}</Link>;
          })}
        </nav>
        <div className="admin-sidebar__bottom">
          <Link href="/" target="_blank"><ExternalLink size={18} /> Ver o site</Link>
          <button type="button" onClick={logout}><LogOut size={18} /> Sair</button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
